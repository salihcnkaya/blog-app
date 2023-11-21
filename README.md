# Blog Uygulaması README

Bu README dosyası, PostgreSQL, Express.js, Node.js ve EJS kullanarak geliştirdiğim blog uygulamasını çalıştırmak ve yapılandırmak için adımları içermektedir.

## Başlangıç

Uygulamayı başlatmadan önce, bilgisayarınızda Node.js ve PostgreSQL'nin yüklü olduğundan emin olun.

## Bağımlılıkların Yüklenmesi

Proje ana dizininde terminali açın ve aşağıdaki komutu kullanarak bağımlılıkları yükleyin:

```bash
npm install
```

Bu komut, package.json dosyasındaki bağımlılıkları otomatik olarak yükleyecektir.

## Veritabani Kurulumu

Uygulamanın çalışması için iki adet tabloya ihtiyaç vardır: users ve posts. Aşağıdaki adımları izleyerek veritabanını oluşturun:

1. PostgreSQL'e bağlanın:

```bash
psql -U postgres
```

2. Veritabanını oluşturun:

```bash
CREATE DATABASE blog_app;
```

3. Oluşturulan veritabanına bağlanın:

```bash
\c blog_app
```

4. `users` ve `posts` tablolarını oluşturun:

```bash
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    user_id INT REFERENCES users(user_id),
    slug VARCHAR(255) NOT NULL,
    post_date DATE
);
```

4. `index.js` içinde gerekli güncellemeleri yapın:

```bash
const db = new pg.Client({
	user: 'postgresql_kullanici_adiniz',
	host: 'localhost',
	database: 'blog_app',
	password: 'postgresql_kullanici_sifreniz',
	port: 5432,
});
```

## Uygulamanın Çalıştırılması

Bağımlılıkların yüklenmesi ve veritabanının oluşturulmasının ardından uygulamayı başlatın:

```bash
npm start
```

Uygulama varsayılan olarak http://localhost:3000 adresinde çalışacaktır.
