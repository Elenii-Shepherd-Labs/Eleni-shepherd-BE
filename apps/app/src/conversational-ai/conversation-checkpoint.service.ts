import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  ChannelVersions,
  Checkpoint,
  CheckpointPendingWrite,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointTuple,
  PendingWrite,
  WRITES_IDX_MAP,
  copyCheckpoint,
  getCheckpointId,
} from '@langchain/langgraph-checkpoint';

type StoredCheckpointRecord = {
  checkpointType: string;
  checkpointValue: string;
  metadataType: string;
  metadataValue: string;
  parentCheckpointId?: string;
};

type StoredWriteRecord = {
  taskId: string;
  channel: string;
  valueType: string;
  value: string;
};

@Injectable()
export class ConversationCheckpointService extends BaseCheckpointSaver {
  private readonly namespaceFallback = '__default__';
  private readonly threadIndexKey = 'conversation:langgraph:threads';

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = this.requireThreadId(config, 'get checkpoint');
    const checkpointNamespace = this.normalizeCheckpointNamespace(
      config.configurable?.checkpoint_ns,
    );
    const checkpoints = await this.getCheckpointBucket(
      threadId,
      checkpointNamespace,
    );

    if (!checkpoints) {
      return undefined;
    }

    let checkpointId = getCheckpointId(config);
    if (!checkpointId) {
      checkpointId = Object.keys(checkpoints).sort((a, b) => b.localeCompare(a))[0];
    }

    if (!checkpointId) {
      return undefined;
    }

    const saved = checkpoints[checkpointId];
    if (!saved) {
      return undefined;
    }

    const checkpoint = (await this.serde.loadsTyped(
      saved.checkpointType,
      this.decode(saved.checkpointValue),
    )) as Checkpoint;
    const metadata = (await this.serde.loadsTyped(
      saved.metadataType,
      this.decode(saved.metadataValue),
    )) as CheckpointMetadata;
    const pendingWrites = await this.getPendingWrites(
      threadId,
      checkpointNamespace,
      checkpointId,
    );

    const checkpointTuple: CheckpointTuple = {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: checkpointId,
        },
      },
      checkpoint,
      metadata,
      pendingWrites,
    };

    if (saved.parentCheckpointId) {
      checkpointTuple.parentConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNamespace,
          checkpoint_id: saved.parentCheckpointId,
        },
      };
    }

    return checkpointTuple;
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    let { before, limit, filter } = options ?? {};
    const threadIds = config.configurable?.thread_id
      ? [config.configurable.thread_id]
      : await this.getThreadIndex();

    for (const threadId of threadIds) {
      const namespaces = config.configurable?.checkpoint_ns
        ? [this.normalizeCheckpointNamespace(config.configurable.checkpoint_ns)]
        : await this.getNamespaceIndex(threadId);

      for (const checkpointNamespace of namespaces) {
        const checkpoints =
          (await this.getCheckpointBucket(threadId, checkpointNamespace)) || {};
        const sortedCheckpoints = Object.keys(checkpoints).sort((a, b) =>
          b.localeCompare(a),
        );

        for (const checkpointId of sortedCheckpoints) {
          if (
            config.configurable?.checkpoint_id &&
            checkpointId !== config.configurable.checkpoint_id
          ) {
            continue;
          }

          if (
            before?.configurable?.checkpoint_id &&
            checkpointId >= before.configurable.checkpoint_id
          ) {
            continue;
          }

          const record = checkpoints[checkpointId];
          const metadata = (await this.serde.loadsTyped(
            record.metadataType,
            this.decode(record.metadataValue),
          )) as CheckpointMetadata;

          if (
            filter &&
            !Object.entries(filter).every(
              ([key, value]) => metadata[key] === value,
            )
          ) {
            continue;
          }

          if (limit !== undefined) {
            if (limit <= 0) {
              return;
            }
            limit -= 1;
          }

          const checkpointTuple = await this.getTuple({
            configurable: {
              thread_id: threadId,
              checkpoint_ns: checkpointNamespace,
              checkpoint_id: checkpointId,
            },
          });

          if (checkpointTuple) {
            yield checkpointTuple;
          }
        }
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const threadId = this.requireThreadId(config, 'put checkpoint');
    const checkpointNamespace = this.normalizeCheckpointNamespace(
      config.configurable?.checkpoint_ns,
    );
    const bucket =
      (await this.getCheckpointBucket(threadId, checkpointNamespace)) || {};
    const preparedCheckpoint = copyCheckpoint(checkpoint);
    const [checkpointType, checkpointBytes] =
      await this.serde.dumpsTyped(preparedCheckpoint);
    const [metadataType, metadataBytes] = await this.serde.dumpsTyped(metadata);

    bucket[checkpoint.id] = {
      checkpointType,
      checkpointValue: this.encode(checkpointBytes),
      metadataType,
      metadataValue: this.encode(metadataBytes),
      parentCheckpointId: config.configurable?.checkpoint_id,
    };

    await this.cacheManager.set(
      this.checkpointBucketKey(threadId, checkpointNamespace),
      bucket,
    );
    await this.addThreadIndex(threadId);
    await this.addNamespaceIndex(threadId, checkpointNamespace);

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNamespace,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const threadId = this.requireThreadId(config, 'put checkpoint writes');
    const checkpointId = config.configurable?.checkpoint_id;
    if (!checkpointId) {
      throw new Error(
        'Failed to put writes. Missing "checkpoint_id" in RunnableConfig.',
      );
    }

    const checkpointNamespace = this.normalizeCheckpointNamespace(
      config.configurable?.checkpoint_ns,
    );
    const writesKey = this.checkpointWritesKey(
      threadId,
      checkpointNamespace,
      checkpointId,
    );
    const existingWrites =
      ((await this.cacheManager.get(writesKey)) as Record<
        string,
        StoredWriteRecord
      > | null) || {};

    await Promise.all(
      writes.map(async ([channel, value], index) => {
        const [valueType, valueBytes] = await this.serde.dumpsTyped(value);
        const writeIndex = WRITES_IDX_MAP[channel] || index;
        const innerKey = `${taskId},${writeIndex}`;

        if (writeIndex >= 0 && existingWrites[innerKey]) {
          return;
        }

        existingWrites[innerKey] = {
          taskId,
          channel,
          valueType,
          value: this.encode(valueBytes),
        };
      }),
    );

    await this.cacheManager.set(writesKey, existingWrites);
  }

  async deleteThread(threadId: string): Promise<void> {
    const namespaces = await this.getNamespaceIndex(threadId);

    for (const checkpointNamespace of namespaces) {
      const checkpoints =
        (await this.getCheckpointBucket(threadId, checkpointNamespace)) || {};

      await Promise.all(
        Object.keys(checkpoints).map((checkpointId) =>
          this.cacheManager.del(
            this.checkpointWritesKey(threadId, checkpointNamespace, checkpointId),
          ),
        ),
      );

      await this.cacheManager.del(
        this.checkpointBucketKey(threadId, checkpointNamespace),
      );
    }

    await this.cacheManager.del(this.namespaceIndexKey(threadId));
    await this.removeThreadIndex(threadId);
  }

  private checkpointBucketKey(threadId: string, checkpointNamespace: string) {
    return `conversation:langgraph:checkpoints:${threadId}:${checkpointNamespace}`;
  }

  private checkpointWritesKey(
    threadId: string,
    checkpointNamespace: string,
    checkpointId: string,
  ) {
    return `conversation:langgraph:writes:${threadId}:${checkpointNamespace}:${checkpointId}`;
  }

  private namespaceIndexKey(threadId: string) {
    return `conversation:langgraph:thread:${threadId}:namespaces`;
  }

  private normalizeCheckpointNamespace(checkpointNs?: string) {
    return checkpointNs?.trim() || this.namespaceFallback;
  }

  private encode(bytes: Uint8Array) {
    return Buffer.from(bytes).toString('base64');
  }

  private decode(value: string) {
    return Buffer.from(value, 'base64');
  }

  private requireThreadId(config: RunnableConfig, operation: string) {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error(
        `Failed to ${operation}. Missing required "thread_id" in RunnableConfig.`,
      );
    }

    return threadId;
  }

  private async getCheckpointBucket(
    threadId: string,
    checkpointNamespace: string,
  ) {
    return (await this.cacheManager.get(
      this.checkpointBucketKey(threadId, checkpointNamespace),
    )) as Record<string, StoredCheckpointRecord> | null;
  }

  private async getPendingWrites(
    threadId: string,
    checkpointNamespace: string,
    checkpointId: string,
  ): Promise<CheckpointPendingWrite[]> {
    const writes =
      ((await this.cacheManager.get(
        this.checkpointWritesKey(threadId, checkpointNamespace, checkpointId),
      )) as Record<string, StoredWriteRecord> | null) || {};

    const pendingWrites = await Promise.all(
      Object.values(writes).map(
        async (write): Promise<CheckpointPendingWrite> => [
          write.taskId,
          write.channel,
          await this.serde.loadsTyped(
            write.valueType,
            this.decode(write.value),
          ),
        ],
      ),
    );

    return pendingWrites;
  }

  private async getThreadIndex() {
    return (
      ((await this.cacheManager.get(this.threadIndexKey)) as string[] | null) ||
      []
    );
  }

  private async addThreadIndex(threadId: string) {
    const threadIds = await this.getThreadIndex();
    if (threadIds.includes(threadId)) {
      return;
    }

    threadIds.push(threadId);
    await this.cacheManager.set(this.threadIndexKey, threadIds);
  }

  private async removeThreadIndex(threadId: string) {
    const threadIds = await this.getThreadIndex();
    const nextThreadIds = threadIds.filter((entry) => entry !== threadId);
    await this.cacheManager.set(this.threadIndexKey, nextThreadIds);
  }

  private async getNamespaceIndex(threadId: string) {
    return (
      ((await this.cacheManager.get(
        this.namespaceIndexKey(threadId),
      )) as string[] | null) || []
    );
  }

  private async addNamespaceIndex(threadId: string, checkpointNamespace: string) {
    const namespaces = await this.getNamespaceIndex(threadId);
    if (namespaces.includes(checkpointNamespace)) {
      return;
    }

    namespaces.push(checkpointNamespace);
    await this.cacheManager.set(this.namespaceIndexKey(threadId), namespaces);
  }
}
