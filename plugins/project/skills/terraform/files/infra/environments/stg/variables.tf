# この環境が外から受け取る値。アルファベット順に並べる
# 値は terraform.tfvars（Git の対象外）か、環境変数 TF_VAR_<名前> で渡す。足したら terraform.tfvars.example にも名前を書く
# 秘匿値でない環境ごとの値は、locals.tf に書く
