(function () {
	const vscode = acquireVsCodeApi();

	document.querySelectorAll('[data-command]').forEach(function (el) {
		el.addEventListener('click', function () {
			vscode.postMessage({ command: el.getAttribute('data-command') });
		});
	});
}());
