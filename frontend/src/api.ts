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
  return new Promise<ApiResp<T>>((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${options.url}`,
      method: options.method,
      data: options.data,
      dataType: "json",
      success: (resp) => {
        resolve(resp.data as unknown as ApiResp<T>);
      },
      fail: reject,
    });
  });
}
