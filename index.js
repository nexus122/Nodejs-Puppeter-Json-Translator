/* 1. Cargamos librerias*/
const puppeteer = require('puppeteer');
const fs = require('fs');

var util = require('util');
var log_file = fs.createWriteStream('./node.log', { flags: 'w' });
var log_stdout = process.stdout;

// Escribir un log
escribir_log = function (d) { //
    if (necesitas_un_log) {
        log_file.write(util.format(d) + '\n');
    }
};

/* Funciones externas */
const funciones = require("./funciones.js");

/* Quieres que se hagan fotos del proceso? */
const screenshots_del_proceso = false;
const necesitas_un_log = false;

// Hacer una foto a cada traducción para comprobar que se haga bien.
if (!fs.existsSync('./json_pendientes_de_traduccion/')) {
    fs.mkdirSync('./json_pendientes_de_traduccion/')
}

// Hacer una foto a cada traducción para comprobar que se haga bien.
if (!fs.existsSync('./json_traducidos/')) {
    fs.mkdirSync('./json_traducidos/')
}

/* Obtenemos la lista de ficheros del directorio */
let ficheros = funciones.encontrar_ficheros_json("./jsons_pendientes_de_traduccion");

// Eliminamos los ficheros que no sean un json
ficheros = ficheros.filter((file) => file.includes(".json"));

/* Medición de tiempo para calcular cuanto ha tardado */
let firstTime = Date.now(); // Tiempo inicial que se crea al cargar el script

/* Bucle de archivos da una vuelta por cada archivo que existe y ejecuta las recursividades. */
for (var b = 0; b < ficheros.length; b++) {

    let aux = 0; // Contador de recursividades para saber que texto estamos traduciendo

    console.log("Iniciando la traducción del fichero: ", ficheros[b]);
    escribir_log("Iniciando la traducción del fichero: ", ficheros[b]);
    const json_english = require(`./jsons_pendientes_de_traduccion/${ficheros[b]}`);

    /* Array de textos no traducidos */
    let array_no_translated_texts = [];
    //console.log("Fichero: ", ficheros[i], "Arrays: ", array_no_translated_texts);

    /* Funciones recursivas para leer jsons */
    function buscador_de_textos(json) {
        try {
            let keys = Object.keys(json);
            if (keys.length >= 1) {
                keys.forEach(key => {
                    if (typeof json[key] != "string") {
                        buscador_de_textos(json[key]);
                    }
                    else if (typeof json[key] == "string") {
                        array_no_translated_texts.push(json[key]);
                    }
                });
            }
        } catch (e) { }
    }

    /* Funcion de traducción recursiva*/
    function traducción_recursiva(json, translated_texts, id) {
        try {
            let keys = Object.keys(json);
            if (keys.length >= 1) {
                keys.forEach(key => {
                    if (typeof json[key] != "string") {
                        traducción_recursiva(json[key], translated_texts, id);
                    } else {
                        try {
                            translated_texts[aux] = translated_texts[aux].trim();
                        } catch (e) { }
                        json[key] = translated_texts[aux];
                        aux++;
                    }
                });
            }
        } catch (e) {
            // console.log(e);
        }
    }

    /* Puppeter Traducción a la pagina   */
    async function traductor_de_textos(texts, id) {

        let arr_translated_texts = [];
        let total_texts = texts.length;
        console.log("Nº deTextos: ", total_texts);
        escribir_log("Nº deTextos: ", total_texts);

        /* Configuración para el bucle */
        let sleep_time; // Tiempo que descansa el puppeter segun el nº de textos
        let inicio = 0;
        let final = 0;
        let intervalo = 1000;

        if (total_texts > intervalo) {
            final = intervalo;
        } else {
            final = total_texts;
        }

        for (let z = 0; z < final; z++) {

            if (final > total_texts) break;

            console.log("------------------------------------------------------------------------------");
            console.log("Navegador Nº: ", (z + 1), " Se reinicia cada: ", intervalo, " Lineas traducidas para evitar problemas de traduccion");
            escribir_log("----------------------------------------------------------------------------------------------------------------");
            escribir_log("Navegador Nº: ", (z + 1), " Se reinicia cada: ", intervalo, " Lineas traducidas para evitar problemas de traduccion");

            if (z == 0) {
                inicio = 0;
                final = final;
            } else {
                inicio = final;
                final = final + 1000;
            }

            /* Abrir el navegador */
            const browser = await puppeteer.launch();
            /* Abrir una nueva pagina */
            const page = await browser.newPage();

            /* Ir a Deepl  */
            await page.goto('https://www.deepl.com/es/translator');

            /* Hacemos un bucle en funcion de cada json. */
            for (let i = inicio; i < final; i++) {

                // Si el texto tiene menos de 4 palabras nos lo saltamos hasta el siguiente punto
                let largo;
                try {
                    largo = texts[i].length;
                } catch (e) {
                    largo = 0;
                }
                if (largo <= 3) {
                    // Si el texto es demasiado corto no lo traducimos pero lo metemos en el array                
                    arr_translated_texts.push(json_english[i]);
                } else {
                    /* Si el largo es mayor de 3 y no es la palabra "age" podemos pasar */

                    //  Hacemos un calculo aproximado de cuanto le llevara a la pagina traducir las palabras para que nos nos queden cortadas por cogerlas antes de tiempo
                    if (id != 1 && id != 2) {
                        if (largo < 10) sleep_time = 800;
                        else if (largo < 100) sleep_time = 900;
                        else if (largo < 200) sleep_time = 1000;
                        else if (largo < 300) sleep_time = 1200;
                        else if (largo < 400) sleep_time = 1600;
                        else if (largo < 800) sleep_time = 2000;
                    }
                    // Si es la primera palabra le damos tiempo a que cargue la pagina con la calma.
                    if (i == inicio) sleep_time = 2000 // La primera vez siempre tarda mas.

                    let textarea_input = ".lmt__source_textarea"; // Selección del textarea

                    // Esperamos que exista el textarea
                    await page.waitForSelector(`${textarea_input}`);
                    // Vaciamos el texto
                    await page.evaluate(() => document.querySelector(".lmt__source_textarea").value = "");

                    if (screenshots_del_proceso) {
                        // Hacer una foto a cada traducción para comprobar que se haga bien.
                        if (!fs.existsSync('./screenShoots/')) {
                            fs.mkdirSync('./screenShoots/')
                        }

                        await page.screenshot({ path: `./screenShoots/${ficheros[id].replace(".json", "")}_${i}.png` });
                    }

                    // Escribimos el texto en ingles en el textarea
                    await page.type(`${textarea_input}`, texts[i]);
                    // Hacemos focus en el textarea
                    await page.focus(`${textarea_input}`);
                    // Pulsamos enter
                    await page.keyboard.press(' ');

                    // Esperamos x tiempo
                    await funciones.delay(sleep_time);

                    // Esperamos al selector del textarea ya traducido
                    await page.waitForSelector('.lmt__target_textarea');
                    // Conseguimos el texto traducido
                    let texto_traducido = await page.evaluate(() => document.querySelector(".lmt__target_textarea").value);

                    // Insertamos el texto traducido en un array                
                    console.log(`\x1b[31m${ficheros[id]} \x1b[0m -> ${((i * 100) / total_texts).toFixed(2)}%  \t Caracteres: \x1b[33m${texts[i].length} \x1b[0m -  Delay: \x1b[33m${sleep_time}\x1b[0m \t \x1b[36m${(i + 1)}\x1b[0m de \x1b[36m${total_texts}\x1b[0m ->  \tTraducción: \x1b[32m${texto_traducido}\x1b[0m`);
                    escribir_log(`${ficheros[id]} -> ${((i * 100) / total_texts).toFixed(2)}%  \t Caracteres: ${texts[i].length} -  Delay: ${sleep_time} \t ${(i + 1)} de ${total_texts} ->  \tTraducción: ${texto_traducido}`);

                    arr_translated_texts.push(texto_traducido); // Introducimos el texto traducido en el array de textos traducidos.

                }
            }
            await browser.close();
        }

        // Devolvemos el array de textos traducidos y un id para saber que fichero es.
        return { texts: arr_translated_texts, id: id };

    };

    /* FUNCIONALIDADES */
    // Lee el json y guarda los textos en un array
    buscador_de_textos(json_english);

    // Funcion que recibe los textos y los reescribe en el json.
    traductor_de_textos(array_no_translated_texts, b).then(function (data) {

        // Recorremos el json, comparamos los campos donde encuentra textos con la posición de texto del array y lo introducimos.
        traducción_recursiva(json_english, data.texts, data.id);

        // Escribimos la nueva informacion en el json.
        funciones.escribir_json(JSON.stringify(json_english), ficheros[data.id]);

        // Calculamos cual ha sido el tiempo de ejecución.
        funciones.tiempo_de_ejecucion(firstTime);

    });
}