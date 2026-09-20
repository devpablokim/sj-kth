import { copyFileSync, existsSync } from "node:fs";

if (existsSync(".env")) {
  console.log(".env 파일이 이미 있습니다. 건너뜁니다.");
} else {
  copyFileSync(".env.example", ".env");
  console.log(".env 파일을 만들었습니다. AI_GATEWAY_API_KEY 값을 채워주세요.");
}
