# この環境から外へ出す値。アルファベット順に並べる
output "environment" {
  description = "この設定の環境名"
  value       = local.environment
}
