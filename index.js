import express from 'express';
import methodOverride from 'method-override';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import slugify from 'slugify';
import pg from 'pg';
import bcrypt from 'bcrypt';

const saltRounds = 10;

const app = express();
const port = 3000;
app.use(methodOverride('_method'));

const db = new pg.Client({
	user: '',
	host: '',
	database: '',
	password: '',
	port: 5432,
});
db.connect();

const blogPosts = [];

app.use(
	session({
		secret: 'secrettext',
		resave: false,
		saveUninitialized: true,
	})
);

app.use(passport.initialize());
app.use(passport.session());

const users = [];

passport.use(
	new LocalStrategy(async (username, password, done) => {
		try {
			const result = await db.query('SELECT * FROM users WHERE username = $1', [
				username,
			]);

			if (result.rows.length > 0) {
				const user = result.rows[0];
				const passwordMatch = await bcrypt.compare(password, user.password);

				if (passwordMatch) {
					return done(null, user);
				} else {
					return done(null, false, { message: 'Sifre hatali' });
				}
			} else {
				return done(null, false, { message: 'Kullanici bulunamadi' });
			}
		} catch (error) {
			return done(error);
		}
	})
);

passport.serializeUser((user, done) => {
	done(null, user.user_id);
});

passport.deserializeUser(async (id, done) => {
	try {
		const result = await db.query('SELECT * FROM users WHERE user_id = $1', [
			id,
		]);

		if (result.rows.length > 0) {
			const user = result.rows[0];
			done(null, user);
		} else {
			done(null, false);
		}
	} catch (error) {
		done(error);
	}
});

const requireAuth = (req, res, next) => {
	if (req.isAuthenticated()) {
		return next();
	} else {
		res.redirect('/login');
	}
};

function createSlug(title) {
	const slug = slugify(title, { lower: true });
	let uniqueSlug = slug;
	let slugCounter = 2;

	while (blogPosts.some((post) => post.slug === uniqueSlug)) {
		uniqueSlug = `${slug}-${slugCounter}`;
		slugCounter++;
	}

	return uniqueSlug;
}

app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/', async (req, res) => {
	try {
		const result = await db.query(`
      SELECT 
        posts.*, 
        users.username as author_username ,
				to_char(posts.post_date, 'DD/MM/YYYY') as formatted_date
      FROM 
        posts 
      INNER JOIN 
        users ON posts.user_id = users.user_id
    `);
		const blogPosts = result.rows;
		res.render('index.ejs', { blogPosts, user: req.user });
	} catch (error) {
		console.error('Error retrieving blog posts:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/create-post', requireAuth, (req, res) => {
	res.render('create-post.ejs', { user: req.user });
});

app.get('/profile', requireAuth, (req, res) => {
	res.render('profile.ejs', { user: req.user });
});

app.post('/new-post', requireAuth, async (req, res) => {
	let date = new Date();
	let day = date.getDate();
	let month = date.getUTCMonth();
	let year = date.getUTCFullYear();
	let postDate = day + '/' + (month + 1) + '/' + year;

	try {
		const { title, content } = req.body;
		const author = req.user;
		const slug = createSlug(title);

		const result = await db.query(
			'INSERT INTO posts (title, content, user_id, slug, post_date) VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING *',
			[title, content, author.user_id, slug]
		);
		const newPost = result.rows[0];
		res.redirect('/');
	} catch (error) {
		console.error('Error adding new post:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/post/:slug', async (req, res) => {
	const slug = req.params.slug;
	const result = await db.query(
		`
      SELECT 
        posts.*, 
        users.username as author_username,
				to_char(posts.post_date, 'DD/MM/YYYY') as formatted_date
      FROM 
        posts 
      INNER JOIN 
        users ON posts.user_id = users.user_id
      WHERE 
        posts.slug = $1
    `,
		[slug]
	);

	if (result.rows.length > 0) {
		const post = result.rows[0];
		res.render('post.ejs', { post, user: req.user });
	} else {
		console.error('Error retrieving blog post:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/login', (req, res) => {
	res.render('login.ejs');
});

app.get('/register', (req, res) => {
	res.render('register.ejs');
});

app.post(
	'/login',
	passport.authenticate('local', {
		successRedirect: '/',
		failureRedirect: '/login',
	})
);

app.post('/register', async (req, res) => {
	const { username, email, password } = req.body;

	try {
		const mailResult = await db.query('SELECT * FROM users WHERE email = $1', [
			email,
		]);
		const usernameResult = await db.query(
			'SELECT * FROM users WHERE username = $1',
			[username]
		);

		if (mailResult.rows.length > 0) {
			return res.status(400).json({ error: 'E-posta adresi kullanimda.' });
		}
		if (usernameResult.rows.length > 0) {
			return res.status(400).json({ error: 'Kullanici adi kullanimda.' });
		}

		const hashedPassword = await bcrypt.hash(password, saltRounds);

		const newUserResult = await db.query(
			'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
			[username, email, hashedPassword]
		);

		const newUser = newUserResult.rows[0];

		req.login(newUser, (err) => {
			if (err) {
				console.error('Error during login:', err);
				return res.status(500).send('Internal server error');
			}
		});
		res.redirect('/');
	} catch (error) {
		console.error('Error during registration:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/edit-post/:slug', requireAuth, async (req, res) => {
	const slug = req.params.slug;

	try {
		const result = await db.query(
			`
      SELECT 
        posts.*, 
        users.username as author_username
      FROM 
        posts 
      INNER JOIN 
        users ON posts.user_id = users.user_id
      WHERE 
        posts.slug = $1
    `,
			[slug]
		);

		if (result.rows.length > 0) {
			const post = result.rows[0];

			if (req.user && post.user_id === req.user.user_id) {
				res.render('edit-post.ejs', { post, user: req.user });
			} else {
				res.status(403).send('Forbidden');
			}
		} else {
			res.status(404).send('Not Found');
		}
	} catch (error) {
		console.error('Error retrieving blog post for editing:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.patch('/update-post/:slug', requireAuth, async (req, res) => {
	const slug = req.params.slug;
	const { title, content } = req.body;

	try {
		const result = await db.query(
			'UPDATE posts SET title = COALESCE($1, title), content = COALESCE($2, content), post_date = CURRENT_DATE WHERE slug = $3 RETURNING *',
			[title, content, slug]
		);

		if (result.rows.length > 0) {
			const updatedPost = result.rows[0];
			res.redirect(`/post/${updatedPost.slug}`);
		} else {
			res.status(404).send('Not Found');
		}
	} catch (error) {
		console.error('Error updating blog post:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.delete('/delete-post/:slug', requireAuth, async (req, res) => {
	const slug = req.params.slug;

	try {
		const result = await db.query(
			'DELETE FROM posts WHERE slug = $1 RETURNING *',
			[slug]
		);

		if (result.rows.length > 0) {
			res.redirect('/');
		} else {
			res.status(404).send('Not Found');
		}
	} catch (error) {
		console.error('Error deleting blog post:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/logout', (req, res) => {
	req.logout((err) => {
		if (err) {
			console.error('Error during logout:', err);
		}
		res.redirect('/login');
	});
});

app.get('/delete-account', requireAuth, (req, res) => {
	res.render('delete-account.ejs', { user: req.user });
});

app.delete('/delete-account', requireAuth, async (req, res) => {
	try {
		const userId = req.user.user_id;

		await db.query('DELETE FROM posts WHERE user_id = $1', [userId]);

		const result = await db.query(
			'DELETE FROM users WHERE user_id = $1 RETURNING *',
			[userId]
		);

		if (result.rows.length > 0) {
			req.logout((err) => {
				if (err) {
					console.error('Error during logout:', err);
				}
				res.redirect('/login');
			});
		} else {
			res.status(404).send('Not Found');
		}
	} catch (error) {
		console.error('Error deleting user account:', error);
		res.status(500).send('Internal Server Error');
	}
});

app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
