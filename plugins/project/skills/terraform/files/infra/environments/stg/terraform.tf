# Terraform 本体とプロバイダの版の指定
terraform {
  # check ブロックを使うため 1.5.0 以上にする。チームで使う版に合わせて上げる
  required_version = ">= 1.5.0"

  # TODO: 使うクラウドのプロバイダと版を書く。版は Terraform Registry で確かめる
  # required_providers {
  #   <名前> = {
  #     source  = "<組織>/<名前>"
  #     version = "~> <メジャー版>.0"
  #   }
  # }
}
