// Code in ~2 hours by Bemmu, idea and sound code snippet from Viznut.
// 2011-09-30 - Modifications by raer.
// 2011-10-07 - Modifications by raer.
// 2019-04 - modernisation by edave64 and opensofias

const $form = document.forms[0];

// ui object contains input elements
const ui =
    't0, tmod, seconds, separation, oneliner, oneliner2'
    .split(', ').reduce ((acc, cur) => (
            acc [cur] = document.getElementById(cur), acc
        ), {}
    )

function makeSampleFunction(oneLiner) {
    const {sin, cos, tan, floor, ceil} = Math;
    eval("var f = function (t) { return " + oneLiner + "}");
    return f;
}

const getCheckedOption = (optionGroup) => {
    for (option of $form[optionGroup])
        if (option.checked) return option.value | 0 
}

const getUiNumbers = (settingsList) =>
    settingsList.reduce ((acc, setting) => (
        acc[setting] = ui[setting].value < 0 ?
            0 :
            ui[setting].value,
        acc)
    ,{})


const mixAB = (a, b, t) =>
    (a + b * t) / (1 + t)

const clamp = (val, min, max) =>
    Math.max(min, Math.min(max,
        Number(val) || min)
    )

function getSoundSettings () {
    return {
        sampleRate: getCheckedOption ('sampleRate'),
        sampleResolution: getCheckedOption ('sampleResolution'),
        ...getUiNumbers('t0, tmod, seconds'.split(', ')),
        separation: 1 - clamp(ui.separation.value, 0, 100) / 100, // wtf
        f: makeSampleFunction(ui.oneliner.value),
        f2: ui.oneliner2.value ? makeSampleFunction(ui.oneliner2.value) : null,
    }
}

function applySoundSettings ({sampleRate, t0, tmod, seconds, separation, f, f2}) {
    ui.t0.value = t0;
    ui.tmod.value = tmod;
    ui.seconds.value = seconds;
    ui.separation.value = separation;
}

function generateSound({sampleRate, t0, tmod, seconds, separation, f, f2, sampleResolution}) {
    var sampleArray = [];
    var channels = f2 ? 2 : 1;
    var sampleMask = sampleResolution == 8 ? 0xff : 0xffff;

    for (var t = t0; t < sampleRate * seconds; t++) {
        //mod t with user-set value if any
        var cT;
        if (tmod > 0) {
            cT = t % tmod;
        }
        else {
            cT = t;
        }

        //left channel
        var sample = f(cT);
        // TODO: pretty reduced resolution. sample seems to go from 0 to 65280, but the function value only from 0 to 255

        var sample2;

        if (channels > 1) {
            //right channel
            sample2 = f2(cT);
            //calculate value with stereo separation and normalize
            var newSample = mixAB(sample, sample2, separation);
            var newSample2 = mixAB(sample2, sample, separation);
            sample = newSample;
            sample2 = newSample2;
            sample2 = sample2;
        }

        //store left sample
        sampleArray.push(sample & sampleMask);
        //store right sample if any
        if (channels > 1) sampleArray.push(sample2 & sampleMask);
    }
    return {sampleRate, sampleArray, channels, sampleResolution};
}

var canvas = null;
var ctx = null;
var imgd = null;

function generatePreview({sampleRate, sampleArray, channels, sampleResolution}) {
    //get canvas element
    canvas = document.getElementById('canvas');
    //get drawing context from canvas element
    ctx = canvas.getContext("2d");

    if (!canvas.getContext) {
        canvas.innerHTML += "No canvas support. Your browser sucks!";
        return;
    }

    imgd = false;
    var width = canvas.width;
    var height = canvas.height;

    imgd = ctx.createImageData(width, height);
    //clear image
    ctx.fillStyle = "#FF0000FF";
    ctx.fillRect(0, 0, width, height);
    
    //get actual pixel data
    var pix = imgd.data;

    const sampleResolutionToColorDepth = 2 ** (sampleResolution - 8);

    var iSample = 0;
    for (var pxIdx = 0; pxIdx < (width * height); pxIdx++) {
        //accumulate sample data for pixel
        var sampleValue = 0;
        var sampleValue2 = 0;

        var sampleIdx = Math.floor(iSample) * channels;
        
        sampleValue = sampleArray[sampleIdx];
        sampleValue = sampleValue / sampleResolutionToColorDepth;

        if (channels > 1) {
            sampleValue2 = sampleArray[sampleIdx + 1];
            sampleValue2 = sampleValue2 / sampleResolutionToColorDepth;
        }

        // Byte position of out current pixel, going from top to bottom, left to right. (With 4 bytes per pixel)
        var index = (width * Math.floor(pxIdx % height) + Math.floor(pxIdx / height)) * 4;
        pix[index] = sampleValue;      // R
        pix[index + 1] = sampleValue2; // G
        pix[index + 2] = 00;           // B
        pix[index + 3] = 0xFF;         // A
        //increase sample index
        iSample += 2 ** 8 / height;
    }

    //write image data to canvas
    ctx.putImageData(imgd, 0, 0);
}

/**
 * [255, 0] -> "%FF%00"
 * @param {number[]} values 
 */
function toHexString(values) {
    return values.reduce((acc, x) => {
        let hex = x.toString(16);
        if (hex.length == 1) hex = "0" + hex;
        return acc + "%" + hex;
    }, "").toUpperCase();
}

// Character to ASCII value, or string to array of ASCII values.
const toCharCodes = (str) => [...str].map((c) => c.charCodeAt(0));

function split32bitValueToBytes(l) {
    return [l & 0xff, (l & 0xff00) >> 8, (l & 0xff0000) >> 16, (l & 0xff000000) >> 24];
}

function FMTSubChunk({channels, sampleResolution, sampleRate}) {
    var byteRate = sampleRate * channels * sampleResolution / 8;
    var blockAlign = channels * sampleResolution / 8;
    return [].concat(
        toCharCodes("fmt "), 
        split32bitValueToBytes(16), // Subchunk1Size for PCM
        [1, 0], // PCM is 1, split to 16 bit
        [channels, 0],
        split32bitValueToBytes(sampleRate),
        split32bitValueToBytes(byteRate),
        [blockAlign, 0],
        [sampleResolution, 0]
    );
}

/**
 * 
 * @param {number[]} sampleArray 
 * @param {number} sampleResolution 
 * @returns {number[]}
 */
function sampleArrayToData(sampleArray, sampleResolution) {    
    if (![8, 16].includes(sampleResolution)) {
        alert("Only 8 or 16 bit supported.");
        return;
    } else if (sampleResolution === 8) return sampleArray;
    else {
        var data = [];
        for (var i = 0; i < sampleArray.length; i++) {
            data.push( 0x00ff & sampleArray[i]      );
            data.push((0xff00 & sampleArray[i]) >> 8);
        }
        return data;
    }
}

function dataSubChunk({channels, sampleResolution, sampleArray}) {
    return [].concat(
        toCharCodes("data"),
        split32bitValueToBytes(sampleArray.length * sampleResolution / 8),
        sampleArrayToData(sampleArray, sampleResolution)
    );
}

function chunkSize(fmt, data) {
    return split32bitValueToBytes(4 + (8 + fmt.length) + (8 + data.length));
}

function RIFFChunk(soundData) {
    var fmt = FMTSubChunk(soundData);
    var data = dataSubChunk(soundData);
    var header = [].concat(toCharCodes("RIFF"), chunkSize(fmt, data), toCharCodes("WAVE"));
    return [].concat(header, fmt, data);
}

function makeDataURL() {
    var settings = getSoundSettings();
    applySoundSettings(settings);
    var generated = generateSound(settings);
    generatePreview(generated);
    return "data:audio/x-wav," + toHexString(RIFFChunk({...generated}));
}

var el;
var lastPosition;

function onTimeUpdate() {
    if (el && canvas && ctx && imgd) {
        var pix = imgd.data;
        //alpha values from last position to FF again
        var index = lastPosition * 4;
        for (var p = 0; p < canvas.height; p++) {
            pix[index] = pix[index] ^ 0xFF;
            pix[index + 1] = pix[index + 1] ^ 0xFF;
            pix[index + 2] = pix[index + 2] ^ 0xFF;
            index += canvas.width * 4;
        }
        var time = el.currentTime;
        var seconds = el.seconds;
        var pos = Math.floor(canvas.width * time / seconds);
        index = pos * 4;
        for (var p = 0; p < canvas.height; p++) {
            pix[index] = pix[index] ^ 0xFF;
            pix[index + 1] = pix[index + 1] ^ 0xFF;
            pix[index + 2] = pix[index + 2] ^ 0xFF;
            index += canvas.width * 4;
        }
        lastPosition = pos;
        //write image data to canvas
        ctx.putImageData(imgd, 0, 0);
    }
}

function stop() {
    if (el) {
        //stop audio and reset src before removing element, otherwise audio keeps playing
        el.pause();
        el.src = "";
        document.getElementById('player').removeChild(el);
        lastPosition = 0;
    }
    el = null;
}

function playDataURI(uri) {
    stop();
    el = document.createElement("audio");
    el.setAttribute("autoplay", true);
    el.setAttribute("src", uri);
    el.setAttribute("controls", "controls");
    el.ontimeupdate = onTimeUpdate;
    document.getElementById('player').appendChild(el);
}
