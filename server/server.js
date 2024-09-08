const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/checkmarks', async (req, res) => {
    const { cookie, page = 1, start = 0, limit = 25 } = req.body;

    if (!cookie) {
        return res.status(400).send('Cookie is required');
    }

    try {
        const response = await axios.post(
            'https://service.fsrar.ru/checkmarks/getmarksnew',
            new URLSearchParams({
                'page': page.toString(),
                'start': start.toString(),
                'limit': limit.toString()
            }),
            {
                headers: {
                    'Accept': '*/*',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookie,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Ошибка при отправке запроса:', error.message);
        res.status(500).send('Ошибка на сервере');
    }
});

app.post('/api/markresult', async (req, res) => {
    const { cookie, page = 1, start = 0, limit = 25, mark_id } = req.body;

    if (!cookie || !mark_id) {
        return res.status(400).send('Cookie и mark_id обязательны');
    }

    try {
        const response = await axios.post(
            'https://service.fsrar.ru/checkmarks/getmarkresult',
            new URLSearchParams({
                'page': page.toString(),
                'start': start.toString(),
                'limit': limit.toString(),
                'mark_id': mark_id.toString()
            }),
            {
                headers: {
                    'Accept': '*/*',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookie,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Ошибка при отправке запроса:', error.message);
        res.status(500).send('Ошибка на сервере');
    }
});

app.listen(port, () => {
    console.log(`Сервер-прокси работает на http://localhost:${port}`);
});