name :common
description "A basic role"

run_list(
	# "recipe[t42-common::postgres]",
	"recipe[t42-common::redis]",
	"recipe[t42-common::nodejs]",
	# "recipe[t42-common::python]",
	# "recipe[t42-common::apache]",
	# "recipe[t42-common::openresty]",
	# "recipe[t42-common::php]",
	# "recipe[t42-common::mysql]",
)