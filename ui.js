function play() {
	//check if oneliner one is empty, but two filled
	if (document.getElementById("oneliner").value == "" && document.getElementById("oneliner2").value != "") {
		//copy string over
		document.getElementById("oneliner").value = document.getElementById("oneliner2").value;
		document.getElementById("oneliner2").value = "";
	}
	//create links
	document.getElementById("link").value = makePermalink();
	//try {
		playDataURI(makeDataURL());
	//    document.getElementById('error').innerText = "";
	//} catch (err) {
	//    document.getElementById('error').innerText = "" + err;
	//}
}

function getParams() {
	var idx = document.URL.indexOf('?');
	if (idx != -1) {
		var tempParams = new Object();
		var pairs = document.URL.substring(idx + 1, document.URL.length).split('&');
		for (var i = 0; i < pairs.length; i++) {
			nameVal = pairs[i].split('=');
			tempParams[nameVal[0]] = nameVal[1];
		}
		return tempParams;
	}
}

function makePermalink() {
	var link;
	var idx = document.URL.indexOf('?');
	if (idx != -1) {
		link = document.URL.substring(0, idx);
	}
	else {
		link = document.URL;
	}
	link += "?oneliner=" + encodeURIComponent(document.getElementById('oneliner').value);
	link += "&oneliner2=" + encodeURIComponent(document.getElementById('oneliner2').value);
	link += "&t0=" + document.getElementById('t0').value;
	link += "&tmod=" + document.getElementById('tmod').value;
	link += "&duration=" + document.getElementById('duration').value;
	link += "&separation=" + document.getElementById('separation').value;
	link += "&rate=" + getCheckedOption ('samplerate'); //TODO: sample resolution value
	return link;
}

var x = document.createElement('audio');
var hasAudio = typeof (x.play) !== 'undefined';
if (!hasAudio) {
	alert("You don't seem to have a browser that supports audio. It's ok, you're not a bad person. But this app will now fail.");
}

document.getElementById("oneliner").focus();
document.getElementById("gen").onclick = function () {
	play();
};

params = getParams();
if (params) {
	var shouldPlay = false;
	if (params["rate"]) {
		for (const input of document.querySelectorAll("input[name='samplerate']")) {
			input.checked = input.value == params["rate"];
		}
	}
	if (params["t0"]) {
		document.getElementById("t0").value = params["t0"];
	}
	if (params["tmod"]) {
		document.getElementById("tmod").value = params["tmod"];
	}
	if (params["duration"]) {
		document.getElementById("duration").value = params["duration"];
	}
	if (params["separation"]) {
		document.getElementById("separation").value = params["separation"];
	}
	if (params["oneliner"]) {
		document.getElementById("oneliner").value = decodeURIComponent(params["oneliner"]);
		shouldPlay = true;
	}
	if (params["oneliner2"]) {
		document.getElementById("oneliner2").value = decodeURIComponent(params["oneliner2"]);
		shouldPlay = true;
	}
	if (shouldPlay) {
		play();
	}
}
