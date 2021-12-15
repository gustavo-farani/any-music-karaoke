const form = document.querySelector('form')  // encontra o formulário na DOM

form.addEventListener('submit', event => {  // quando submeter
    // OBS: o evento submit não será disparado
    // caso a URL não siga o formato https://music.youtube.com\/watch\?v=.*,
    // essa pré-checagem foi especificada com o atributo 'pattern' da tag 'input', pelo próprio HTML
    // material de consulta: https://developer.mozilla.org/pt-BR/docs/Learn/Forms/Form_validation#validating_against_a_regular_expression
    // quando o usuário submete uma URL que não é do YouTube Music, aparece uma mensagem de alerta dizendo
    // 'Please, match the requested pattern', e o formulário não é submetido
    // Seria bom customizar essa mensagem de alerta, traduzindo para português
    //

    event.preventDefault(); // desabilita o envio do formulário pelo browser, pois faremos com JavaScript
    
    document.getElementById('main').classList.add('hidden'); // adiciona a classe loading ao elemento main
    document.getElementById('spinner').classList.remove('hidden'); // adiciona a classe loading ao elemento main

    const body = {
        share: form.querySelector('input[name="share"]').value  // URL para a música no YouTube Music
    }
    alert('Submissão enviada')
    console.log(body.share)
    fetch('/', {  // faz uma requisição POST para a rota '/'
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)  // envia a URL submetida dentro de um JSON
    })
    .then(res => res.json())  // a resposta do server vai ser um JSON também
    .then(submission => {
        // esse objeto submission vai ter as seguintes propriedades:
        // * autoGenerated: Boolean que é true caso a URL submetida seja de um vídeo como este aqui (é uma música):
        // https://music.youtube.com/watch?v=D4INE2zO9OU&list=OLAK5uy_m4qKWIIN3T_8MYnEh2_0YlVPeAIrSoC8Q
        // e false caso seja como este (é o clipe de uma música):
        // https://music.youtube.com/watch?v=8DyziWtkfBw&list=PLsK0gCOg4x1foFzncrcWYDf7UY1WLnsgN
        // não é para submeter clipes de música, porque a descrição do vídeo não segue um padrão
        // (aí não dá para extrair o nome do artista, o nome da música e arte do álbum tão fácil)
        // * lyrics: String com a letra da música extraída do site Genius
        // * csrf: token necessário para fazer a autenticação com o Pusher
        // * audioURL: URL para o áudio do acompanhamento musical (removido os vocais)

        if (submission.autoGenerated) {  // clipes não serão aceitos, somente músicas (validação de formulário)
            alert('Áudio pronto')
            console.log(`http://localhost:3000/${submission.audioURL}`)
            // essa biblioteca Pusher serve para trazer mudanças "em tempo real" no site com JavaScript
            // é utilizado pelo site do AutoLyrixAlign para fazer a comunicação
            // DO servidor PARA o browser quando a legenda está pronta,
            // SEM utilizar requisições HTTP normais

            // primeiro, crie uma instância autenticada do Pusher
            let pusher = new Pusher('3829b8fc32056017e419',  // ID do AutoLyrixAlign
            {
                cluster: 'ap2',
                forceTLS: true,
                authEndpoint: '/pusher/auth',
                auth: {
                    headers: {
                        'X-CSRF-Token': submission.csrf  // o token para a autenticação vai vir no JSON de resposta do fetch
                    }
                }
            })
            // com o Pusher, um mesmo servidor pode ter vários canais, e cada canal pode ter múltiplos eventos
            // quando a legenda estiver pronta, o servidor do AutoLyrixAlign vai disparar um evento
            // 'processing.completed' no canal 'lyrix-channel'
            var channel = pusher.subscribe('lyrix-channel')

            // Programamos o callback [a função function(data) {...} ]
            // que será executado em resposta a esse evento
            channel.bind('processing.completed', function(data) {
                // no objeto data vão vir as URLs (parciais) para três arquivos de legenda em formatos diferentes
                // porém ainda é preciso processar as essas URLs para o formato certo,
                // e esse objeto download cuida disso
                download = {
                    simple: `https://autolyrixalign.hltnus.org/result/result_${data.lyrix.split("json/")[1]}`,
                    json: `https://autolyrixalign.hltnus.org/storage${data.lyrix}`,
                    lrc: `https://autolyrixalign.hltnus.org/storage${data.lrcLyric}`,
                }
                alert('Legenda pronta')
                console.log(download.simple)
            })
        } else {
            alert('Não é para submeter clipe de música')
        }
    })
})