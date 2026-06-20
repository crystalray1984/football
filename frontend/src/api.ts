import {} from "@dcloudio/uni-app";

const API_BASE = "http://127.0.0.1:10030";

const token = {
  value: "",
};

export function setToken(value: string) {
  token.value = value;
}

export interface ApiOptions {
  url: string;
  method?: "GET" | "POST";
  data?: any;
}

export function api<T = void>(options: ApiOptions) {
  const header: Record<string, string> = {};
  if (token.value) {
    header.token = token.value;
  }
  return new Promise<ApiResp<T>>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${options.url}`,
      method: options.method,
      data: options.data,
      dataType: "json",
      header,
      success: (resp) => {
        resolve(resp.data as unknown as ApiResp<T>);
      },
      fail: reject,
    });
  });
}
