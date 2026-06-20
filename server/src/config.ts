import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const configDir = resolve(__dirname, "..");
const configPath = resolve(configDir, "config.yaml");

/**
 * 读取并解析 YAML 配置文件。
 *
 * @param path 配置文件绝对路径。
 * @returns 解析后的配置对象。
 * @throws 当文件不存在、不可读或 YAML 语法非法时抛出原始错误。
 */
function readYamlConfig<T>(path: string): T {
  return parse(readFileSync(path, "utf-8")) as T;
}

/** 应用配置实例，模块导入时自动从 config.yaml 加载 */
export const config: AppConfig = readYamlConfig<AppConfig>(configPath);
