export interface IAppResponse {
  success: boolean;
  message: string;
  data: any;
  // Optional HTTP status code (e.g. 200, 201, 400, 404, 500)
  status?: number;
}
