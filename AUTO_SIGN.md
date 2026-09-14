# 自动签到配置

项目现在支持通过本地服务端定时任务自动签到。浏览器可以关闭，账号密码只保存在本机配置文件，不会写入前端或远程仓库。

## 本地配置

首次使用时编辑 `config/ucas-account.json`：

```json
{
  "username": "你的学号",
  "password": "你的密码",
  "cronSecret": "随机生成的长字符串"
}
```

该文件已加入 `.gitignore`，不会被 `git add`、提交或推送。不要手动强制添加它。

## 本地运行

先启动 Next.js 服务：

```bash
npm run dev
```

再打开另一个终端启动本地调度器：

```bash
npm run auto-sign
```

调度器启动时只查询一次当天课表，然后按照每门课程的开课时间注册定时器；它不会每分钟重复登录和查询整张课表。当天课表处理完后，会在北京时间次日零点重新获取下一天课表。单次签到失败时最多重试 3 次，每次间隔 30 秒。

生产模式：

```bash
npm run build
npm run start
npm run auto-sign
```

调度器在课程签到窗口开始时调用：

```text
GET http://127.0.0.1:3000/api/course-uuid/cron-sign
```

路由只接受配置文件中的 `cronSecret`。每次运行会：

1. 按北京时间查询当天课表。
2. 跳过已签到课程和没有 7 位课程 ID 的记录。
3. 只处理开课前 30 分钟到下课之间的课程。
4. 为当前窗口内的每门未签到课程发起一次签到。

也可以手动检查本地自动签到接口，命令不会输出密码：

```bash
curl -H "Authorization: Bearer 你的cronSecret" \
  http://127.0.0.1:3000/api/course-uuid/cron-sign
```

## 限制

- `npm run auto-sign` 需要与 Next.js 服务同时运行；关闭触发器进程后不会继续自动签到。
- 当前配置文件是本地文件，因此 Vercel 等远程部署环境不会拥有账号密码，也不会自动签到。
- 上游接口、账号状态、课程签到窗口或部署平台故障都可能导致签到失败；路由响应和平台日志会记录结果。
