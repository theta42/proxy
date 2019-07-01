[
	'php',
	'libapache2-mod-php',
].each do |pkg|
	apt_package pkg
end
