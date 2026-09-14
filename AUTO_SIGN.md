# 自动签到配置

项目现在支持通过服务端定时任务自动签到。浏览器可以关闭，账号密码也不会写入前端或源码。

## 环境变量

在部署平台配置以下变量：

```env
UCAS_USERNAME=你的学号
UCAS_PASSWORD=你的密码
CRON_SECRET=随机生成的长字符串
```

不要把真实密码写入 `.env.example`、Git 或前端代码。

## Vercel 部署

仓库根目录的 `vercel.json` 会让 Vercel 每分钟调用一次：

```text
GET /api/course-uuid/cron-sign
```

路由只接受带有 `CRON_SECRET` 的请求。每次运行会：

1. 按北京时间查询当天课表。
2. 跳过已签到课程和没有 7 位课程 ID 的记录。
3. 只处理开课前 30 分钟到下课之间的课程。
4. 为当前窗口内的每门未签到课程发起一次签到。

可用以下方式手动检查部署配置，命令不会输出密码：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://你的域名.vercel.app/api/course-uuid/cron-sign
```

## 限制

- 自动任务依赖部署平台实际执行 Cron；本地 `npm run dev` 不会自行定时调用。
- Vercel Cron 的实际执行时间可能有延迟，因此任务按分钟检查，而不是保证在某个秒数执行。
- 上游接口、账号状态、课程签到窗口或部署平台故障都可能导致签到失败；路由响应和平台日志会记录结果。
