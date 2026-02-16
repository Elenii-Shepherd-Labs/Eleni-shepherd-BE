import { IAppResponse } from '../interfaces/response.interface';

export function createAppResponse(
  success: boolean,
  message: string,
  data: any = null,
  status?: number,
): IAppResponse {
  return {
    success,
    message,
    data,
    status,
  };
}

export default createAppResponse;
