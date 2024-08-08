members = ['Roisin', 'Billy', 'Joseph', 'Emily', 'Chloe']

message = "I love you {}"

for member in members:
	if member == "Billy":
		continue
	print(message.format(member))