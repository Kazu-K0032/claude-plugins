# state（インフラの今の状態の記録）の置き場所
# TODO: 共有でき、ロックできる backend（クラウドのストレージなど）を書く。
# 書くまでは state が手元にでき、ほかの人と共有できず、消すと管理を失う。そのため apply しない。
# 環境ごとに state を分けるため、置き場所のキーには環境名を入れる。
# Ref: https://developer.hashicorp.com/terraform/language/backend
# terraform {
#   backend "<種類>" {
#   }
# }
