import type { RestCooldown } from "./api";

export default function RestCooldownNotice({ cooldown, now }: { cooldown: RestCooldown; now: number }) {
  const seconds = Math.max(0, Math.ceil((cooldown.retry_at - now) / 1000));
  if (seconds === 0) return null;
  const deadline = new Date(cooldown.retry_at).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  return <div className="rest-cooldown" role="status" aria-live="polite">
    <strong>{cooldown.http_status === 418 ? "币安暂时封禁当前网络出口" : "币安请求频率受限"}</strong>
    <p>合约行情查询已暂停，预计北京时间 <b>{deadline}</b> 后自动重试。
      <span aria-live="off"> 剩余 {Math.floor(seconds / 60)} 分 {seconds % 60} 秒。</span>
    </p>
    <p>已连接的实时推送继续更新，已有数据保留显示。</p>
  </div>;
}
