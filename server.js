const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const cheerio = require('cheerio')
const { getLyrics } = require('genius-lyrics-api')
const fs = require('fs')
const https = require('https')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const app = express()
const port = 3000

app.use(express.static('public'))
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.set('view engine', 'ejs')

app.listen(port, () => {
    console.log(`http://localhost:${port}`)
})

app.post('/', (req, res) => {
    controller(req.body.share.split('&')[0].replace('music', 'www'))
        .then(ans => res.json(ans))
})

async function controller(share) {
    try {
        const { stdout } = await exec(`echo $${share} | python description.py`)
        const [path, subtitles] = await Promise.all([getAudio(share), postSubtitles(share, stdout)])
        return { audioURL: path, ...subtitles, autoGenerated: true }
    } catch (err) {
        return { autoGenerated: false }
    }
}

async function postSubtitles(share, description) {
    const [tokens, lyrics] = await Promise.all([getAutoLyrixAlignTokens(), getGeniusLyrics(description)])
    const boundary = '---------------------------17312309539142609584114046060'
    const payload = [
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"youtube_link\"",
        '',
        share,
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"lyrix_file\"; filename=\"lyrix.txt\"",
        "Content-Type: text/plain",
        '',
        lyrics,
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"upload_type\"",
        '',
        'youtube',
        `--${boundary}--`,
        ''
    ].join('\r\n')
    const options = {
        'method': 'POST',
        'hostname': 'autolyrixalign.hltnus.org',
        'path': '/lyrix/submit',
        'headers': {
            'Host': 'autolyrixalign.hltnus.org',
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:94.0) Gecko/20100101 Firefox/94.0',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://autolyrixalign.hltnus.org',
            'Connection': 'keep-alive',
            'Referer': 'https://autolyrixalign.hltnus.org/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(payload),
            'Cookie': `XSRF-TOKEN=${tokens.xsrf}; laravel_session=${tokens.session}`,
            'X-CSRF-TOKEN': tokens.csrf,
        }
    }
    https.request(options).end(payload)
    return { csrf: tokens.csrf, lyrics }
}

async function getGeniusLyrics(description) {
    const [title, artist] = description.split('\n')
    const lyrics = await getLyrics({
        title: title,
        artist: artist,
        apiKey: 'xMB-4sq7lsl3D4Q3kCjjgjvz5A1CROp9k2ZFkw3WW-4JzNr-gUcXPixegMyhkALo',
        optimizeQuery: true
    })
    const regex = /\[.*\]\n/g
    return lyrics.replaceAll(regex, '')
}

async function getAutoLyrixAlignTokens() {
    const index = await axios.get('https://autolyrixalign.hltnus.org/', {
        headers: {
            'Host': 'autolyrixalign.hltnus.org',
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:94.0) Gecko/20100101 Firefox/94.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        }
    })
    const $ = cheerio.load(index.data)
    const csrf = $("meta[name='csrf-token']").attr('content')
    const [xsrf, session] = index.headers['set-cookie'].map(cookie => cookie.split("; ")[0].split('=')[1])
    return {
        csrf: csrf,
        xsrf: xsrf,
        session: session
    }
}

async function getAudio(url) {
    const { stdout } = await exec(`./core.sh ${url}`)
    return stdout.trim()
}