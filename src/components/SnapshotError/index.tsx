import s from './SnapshotError.module.css'

interface SnapshotErrorProps {
  message: string
}

export function SnapshotError({ message }: SnapshotErrorProps) {
  return (
    <div className={s.shell}>
      <div className={s.card}>
        <div className={s.kicker}>LOCAL DATA</div>
        <h1 className={s.title}>本地数据文件加载失败</h1>
        <p className={s.body}>{message}</p>
        <div className={s.hint}>
          请确认 <strong>public/data/radio-snapshot.json</strong> 存在且内容有效，然后重新启动应用。
        </div>
      </div>
    </div>
  )
}