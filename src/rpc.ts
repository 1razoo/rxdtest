import axios, { AxiosBasicCredentials, AxiosResponse } from "axios";

export interface JsonRpc {
  (method: string, params?: string[]): Promise<AxiosResponse<any, any>>;
}

const rpcClient = async (): Promise<JsonRpc> => {
  const url = `http://${process.env.RPC_HOSTNAME || "localhost"}:${
    process.env.RPC_PORT || "7332"
  }`;
  const auth: AxiosBasicCredentials = {
    username: process.env.RPC_USERNAME || "",
    password: process.env.RPC_PASSWORD || "",
  };
  const rpc = async (method: string, params: string[] = []) => {
    try {
      return await axios.post(
        url,
        {
          jsonrpc: "1.0",
          method,
          params,
        },
        {
          auth,
        }
      );
    } catch (error: any) {
      return error.response;
    }
  };
  const info = (await rpc("getblockchaininfo")).data.result;
  expect(info.chain).toBe("test");
  return rpc;
};

export default rpcClient;
