import { ConversationCheckpointService } from './conversation-checkpoint.service';

describe('ConversationCheckpointService', () => {
  let service: ConversationCheckpointService;
  let cacheStore: Map<string, unknown>;
  let cacheManager: {
    get: jest.Mock<Promise<unknown>, [string]>;
    set: jest.Mock<Promise<void>, [string, unknown]>;
    del: jest.Mock<Promise<void>, [string]>;
  };

  beforeEach(() => {
    cacheStore = new Map();
    cacheManager = {
      get: jest.fn(async (key: string) => cacheStore.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        cacheStore.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        cacheStore.delete(key);
      }),
    };

    service = new ConversationCheckpointService(cacheManager as never);
  });

  it('persists and reloads the latest checkpoint tuple for a thread', async () => {
    const config = {
      configurable: {
        thread_id: 'session-1',
      },
    };

    const savedConfig = await service.put(
      config,
      {
        v: 4,
        id: 'checkpoint-1',
        ts: '2026-03-19T00:00:00.000Z',
        channel_values: {
          responseText: 'Hello from the graph.',
        },
        channel_versions: {
          responseText: 1,
        },
        versions_seen: {},
      },
      {
        source: 'loop',
        step: 0,
        parents: {},
      },
      {},
    );

    await service.putWrites(
      savedConfig,
      [['actions', [{ type: 'navigate', screen: 'News' }]]],
      'task-1',
    );

    const tuple = await service.getTuple(config);

    expect(tuple?.config).toEqual({
      configurable: {
        thread_id: 'session-1',
        checkpoint_ns: '__default__',
        checkpoint_id: 'checkpoint-1',
      },
    });
    expect(tuple?.checkpoint.channel_values).toEqual({
      responseText: 'Hello from the graph.',
    });
    expect(tuple?.pendingWrites).toEqual([
      ['task-1', 'actions', [{ type: 'navigate', screen: 'News' }]],
    ]);
  });

  it('deletes thread checkpoints, writes, and indexes together', async () => {
    const savedConfig = await service.put(
      {
        configurable: {
          thread_id: 'session-cleanup',
        },
      },
      {
        v: 4,
        id: 'checkpoint-cleanup',
        ts: '2026-03-19T00:00:00.000Z',
        channel_values: {},
        channel_versions: {},
        versions_seen: {},
      },
      {
        source: 'input',
        step: -1,
        parents: {},
      },
      {},
    );

    await service.putWrites(savedConfig, [['actions', ['noop']]], 'task-cleanup');
    await service.deleteThread('session-cleanup');

    expect(
      await service.getTuple({
        configurable: {
          thread_id: 'session-cleanup',
        },
      }),
    ).toBeUndefined();
    expect(cacheStore.get('conversation:langgraph:threads')).toEqual([]);
    expect(
      cacheStore.get('conversation:langgraph:thread:session-cleanup:namespaces'),
    ).toBeUndefined();
  });
});
