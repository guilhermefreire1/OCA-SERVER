// Importações necessárias
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');
const moment = require('moment');

const app = express();
const port = 5000;

const pool = new Pool({
    user: 'MateusSiqueira',
    host: 'oca.postgres.database.azure.com',
    database: 'postgres',
    password: 'Oca@2024',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

// Aumenta o limite do payload para 10 MB
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors());

// Função para registrar logs detalhados
const logRequest = (message, data) => console.log(`${message}:`, data);

// Função para gerar código de recuperação
const generateRecoveryCode = () => crypto.randomBytes(4).toString('hex');

// Rota de cadastro de usuário
app.post('/api/cadastro', async (req, res) => {
    const { name, birth_date, email, password, street, neighborhood, city, number, profile_type } = req.body;

    logRequest("Dados recebidos para cadastro", req.body);

    if (!name || !birth_date || !email || !password || !street || !neighborhood || !city || !number) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        const checkEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (checkEmail.rows.length > 0) {
            console.warn("E-mail já cadastrado:", email);
            return res.status(400).json({ error: 'E-mail já cadastrado.' });
        }

        const insertUserQuery = `
            INSERT INTO users (name, birth_date, email, password, street, neighborhood, city, number, profile_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING user_id, name, email, profile_type;
        `;
        const values = [name, birth_date, email, password, street, neighborhood, city, number, profile_type];
        const result = await pool.query(insertUserQuery, values);

        logRequest("Usuário cadastrado com sucesso", result.rows[0]);

        res.status(201).json({ user: result.rows[0] });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota de login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    logRequest("Tentativa de login para o email", email);

    if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            console.warn("E-mail não encontrado:", email);
            return res.status(404).json({ error: 'E-mail não encontrado.' });
        }

        const user = result.rows[0];
        logRequest("Usuário encontrado", user);

        if (user.password !== password) {
            console.warn("Senha incorreta para o email:", email);
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        res.status(200).json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            profile_type: user.profile_type,
            street: user.street,
            number: user.number,
            neighborhood: user.neighborhood,
            city: user.city,
            password: user.password,
            profile_image: user.profile_image // Inclui a imagem do perfil
        });
    } catch (error) {
        console.error('Erro ao realizar login:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para buscar os dados do usuário pelo user_id
app.get('/api/user/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const user = result.rows[0];
        res.status(200).json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            profile_type: user.profile_type,
            street: user.street,
            number: user.number,
            neighborhood: user.neighborhood,
            city: user.city,
            profile_image: user.profile_image // Retorna a imagem do perfil
        });
    } catch (error) {
        console.error('Erro ao buscar os dados do usuário:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para atualizar dados do usuário, incluindo a foto de perfil
app.put('/api/update-user', async (req, res) => {
    const { user_id, name, email, street, number, neighborhood, city, profile_image } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
    }

    try {
        const query = `
            UPDATE users
            SET name = $1, email = $2, street = $3, number = $4, neighborhood = $5, city = $6, profile_image = $7
            WHERE user_id = $8
            RETURNING *;
        `;
        const values = [name, email, street, number, neighborhood, city, profile_image, user_id];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        res.status(200).json({ message: 'Dados atualizados com sucesso!', user: result.rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para adicionar produto
app.post('/api/products', async (req, res) => {
    const { user_id, product_name, description, price, production_time, tribe_name, image_data } = req.body;

    if (!user_id || !product_name || !description || !price || !production_time || !tribe_name) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    try {
        const insertProductQuery = `
            INSERT INTO products (user_id, product_name, description, price, production_time, image_data, tribe_name, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING product_id;
        `;
        const createdAt = moment().toISOString();
        const values = [user_id, product_name, description, price, production_time, image_data, tribe_name, createdAt];

        const result = await pool.query(insertProductQuery, values);

        res.status(201).json({ message: 'Produto adicionado com sucesso!', product_id: result.rows[0].product_id });
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para atualizar produto
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { product_name, description, price, production_time, tribe_name, image_data } = req.body;

    if (!product_name || !description || !price || !production_time || !tribe_name) {
        return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    try {
        const updateProductQuery = `
            UPDATE products
            SET product_name = $1,
                description = $2,
                price = $3,
                production_time = $4,
                tribe_name = $5,
                image_data = $6,
                updated_at = $7
            WHERE product_id = $8
            RETURNING *;
        `;
        const updatedAt = moment().toISOString();
        const values = [product_name, description, price, production_time, tribe_name, image_data, updatedAt, id];

        const result = await pool.query(updateProductQuery, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        res.status(200).json({ message: 'Produto atualizado com sucesso!', product: result.rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para excluir um produto pelo ID
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM products WHERE product_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        res.status(200).json({ message: 'Produto excluído com sucesso.', product: result.rows[0] });
    } catch (error) {
        console.error('Erro ao excluir o produto:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para buscar produtos cadastrados por um usuário
app.get('/api/products/user/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM products WHERE user_id = $1', [user_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Nenhum produto encontrado para este usuário.' });
        }

        res.status(200).json({ products: result.rows });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// Rota para buscar os detalhes de um produto pelo product_id
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM products WHERE product_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar detalhes do produto:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

// ROTAS DO FEED

// Rota para criar postagem (sem imagem)
app.post('/api/feed', async (req, res) => {
    const { user_id, content } = req.body;

    if (!user_id || !content) {
        return res.status(400).json({ error: 'Usuário e conteúdo são obrigatórios.' });
    }

    try {
        const query = `
            INSERT INTO posts (user_id, content)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const values = [user_id, content];
        const result = await pool.query(query, values);

        res.status(201).json({ post: result.rows[0] });
    } catch (error) {
        console.error('Erro ao criar postagem:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

app.get('/api/feed', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const query = `
            SELECT posts.*, users.name, users.profile_image
            FROM posts
            JOIN users ON posts.user_id = users.user_id
            ORDER BY posts.created_at DESC
            LIMIT $1 OFFSET $2;
        `;
        const totalQuery = 'SELECT COUNT(*) FROM posts;';

        const posts = await pool.query(query, [limit, offset]);
        const total = await pool.query(totalQuery);

        res.status(200).json({
            posts: posts.rows,
            total: parseInt(total.rows[0].count, 10),
        });
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

app.post('/api/feed/comments', async (req, res) => {
    const { post_id, user_id, comment } = req.body;

    if (!post_id || !user_id || !comment) {
        return res.status(400).json({ error: 'Post, usuário e comentário são obrigatórios.' });
    }

    try {
        const query = `
            INSERT INTO comments (post_id, user_id, comment)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const values = [post_id, user_id, comment];
        const result = await pool.query(query, values);

        res.status(201).json({ comment: result.rows[0] });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

app.get('/api/feed/comments', async (req, res) => {
    const { post_id } = req.query;

    if (!post_id) {
        return res.status(400).json({ error: 'O ID do post é obrigatório.' });
    }

    try {
        const query = `
            SELECT comments.*, users.name, users.profile_image
            FROM comments
            JOIN users ON comments.user_id = users.user_id
            WHERE comments.post_id = $1
            ORDER BY comments.created_at ASC;
        `;
        const result = await pool.query(query, [post_id]);

        res.status(200).json({ comments: result.rows });
    } catch (error) {
        console.error('Erro ao buscar comentários:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

app.post('/api/feed/like', async (req, res) => {
    const { post_id, user_id } = req.body;

    if (!post_id || !user_id) {
        return res.status(400).json({ error: 'Post e usuário são obrigatórios.' });
    }

    try {
        const checkQuery = `
            SELECT * FROM likes WHERE post_id = $1 AND user_id = $2;
        `;
        const insertQuery = `
            INSERT INTO likes (post_id, user_id)
            VALUES ($1, $2);
        `;
        const deleteQuery = `
            DELETE FROM likes WHERE post_id = $1 AND user_id = $2;
        `;

        const likeExists = await pool.query(checkQuery, [post_id, user_id]);

        if (likeExists.rows.length > 0) {
            // Remover curtida
            await pool.query(deleteQuery, [post_id, user_id]);
            await pool.query('UPDATE posts SET likes = likes - 1 WHERE post_id = $1;', [post_id]);
            return res.status(200).json({ message: 'Curtida removida.' });
        }

        // Adicionar curtida
        await pool.query(insertQuery, [post_id, user_id]);
        await pool.query('UPDATE posts SET likes = likes + 1 WHERE post_id = $1;', [post_id]);
        res.status(200).json({ message: 'Curtida adicionada.' });
    } catch (error) {
        console.error('Erro ao curtir/descurtir postagem:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});


app.delete('/api/feed/:post_id', async (req, res) => {
    const { post_id } = req.params;
    const { user_id } = req.body;

    if (!post_id || !user_id) {
        return res.status(400).json({ error: 'Post ID e User ID são obrigatórios.' });
    }

    try {
        const query = `
            DELETE FROM posts
            WHERE post_id = $1 AND user_id = $2
            RETURNING *;
        `;
        const result = await pool.query(query, [post_id, user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Postagem não encontrada ou você não tem permissão para excluí-la.' });
        }

        res.status(200).json({ message: 'Postagem excluída com sucesso.', post: result.rows[0] });
    } catch (error) {
        console.error('Erro ao excluir postagem:', error);
        res.status(500).json({ error: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});



// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
