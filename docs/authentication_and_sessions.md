Authentication	and	sessions

Q1	�	OTP	error	catalogue

We	don't	distinguish	these	outcomes,	by	design.	A	code	request	always	returns	the	same	response,	and	a	failed	check	always	returns
the	same	failure	�	whether	the	number	is	unregistered,	the	code	was	wrong,	the	code	expired,	or	the	number	is	temporarily	frozen.
Anything	more	specific	would	let	the	channel	be	used	to	discover	which	phone	numbers	hold	accounts.

POST	/v1/auth/otp/start 	always	returns	 200 .	 POST	/v1/auth/otp/verify 	returns	 401 	/	 AuthenticationFailed 	/	 1002 	for	every	failure.
The	only	 400 s	are	format	validation	( InvalidInput 	/	 1001 ).

For	the	bot:	use	a	neutral	message	�	"that	didn't	work,	shall	I	send	a	new	code?"

Q2	�	OTP	behaviour

Code	valid	for	5	minutes

3	codes	per	number	per	5	minutes.	A	resend	delivers	the	same	code,	not	a	new	one

5	wrong	attempts	per	number	per	hour.	After	that	the	number	is	frozen	for	the	rest	of	the	hour	�	code	requests	are	accepted
but	no	SMS	is	sent.	A	correct	code	clears	the	freeze	immediately

Phone:	7�13	digits.	Code:	4�8	digits	accepted

These	limits	are	shared	with	the	Liquid	Barcodes	mobile	app,	on	the	same	counter.	A	customer	who	just	failed	three
attempts	in	the	app	arrives	at	the	bot	with	two	left.	Worth	knowing	up	front	�	it	will	look	like	a	defect	in	support	tickets	otherwise.

Q3	�	Enumeration	control

OTP	is	safe	against	account	discovery,	and	it's	the	right	path	for	you.	That	safety	comes	from	the	uniform	responses	in	Q1,	not	from
throttling.

There	is	no	throttling	on	our	side	today,	so	there	are	no	values	to	confirm	against	the	OTP	endpoints.	See	Q14.

Every	wrong	attempt	looks	identical	to	the	bot.	There	is	no	"you	are	now	locked	out"	signal.

Q4	�	Token	expiry

One	hour,	and	that	is	the	configured	value

No	refresh	tokens.	Re-authenticating	means	a	new	OTP	or	a	new	SSO	hand-off

Expiry	is	not	distinguishable	from	other	authentication	failures

HTTP

code

errorCode

Meaning

401

401

401

403

AuthenticationFailed

1002

Bad	key,	bad/missing	token,	unknown	or	expired	session,	failed	OTP/SSO	verification

InvalidSignature

SessionInvalid

InsufficientScope

1003

1004

1005

Bad	signature,	or	missing/unparsable/out-of-window	timestamp	(�10	min)

Session	lost	between	auth	and	handler.	Not	the	normal	expiry	path

Authenticated,	but	lacks	the	endpoint's	scope

The	rule	for	your	developers:	 1002 	�	re-authenticate	once.	 1003 	�	do	not	retry,	it's	a	configuration	or	clock	problem.	If	re-
authentication	after	a	 1002 	also	fails,	treat	it	as	configuration	rather	than	looping.

Q5	�	Non-member	callers

There's	no	"no	account	found"	response	to	show	you,	because	we	never	return	one	�	an	unregistered	number	gets	exactly	the	same
response	as	a	registered	one.	On	the	SSO	route,	an	unknown	or	expired	token	returns	 401 	/	 AuthenticationFailed 	/	 1002 .

We	have	no	endpoint	that	creates	users,	and	none	that	answers	"does	this	number	have	an	account."

Wash	codes	and	coupons