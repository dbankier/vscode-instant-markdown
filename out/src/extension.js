"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const server_1 = require("./server");
const path = require('path');
const open = require('opn');
const hljs = require('highlight.js');
const MarkdownIt = require('markdown-it');
const debounce = require('debounce');
function activate(context) {
    var instantMarkdown = new InstantMarkdown();
    var instantMarkdownController = new InstantMarkdownController(instantMarkdown);
    context.subscriptions.push(instantMarkdown);
    context.subscriptions.push(instantMarkdownController);
    context.subscriptions.push(vscode.commands.registerCommand('instantmarkdown.openBrowser', openBrowser));
}
let last_instance;
function openBrowser() {
    var port = vscode.workspace.getConfiguration("instantmarkdown").get("port");
    var host = vscode.workspace.getConfiguration("instantmarkdown").get("host");
    open("http://" + host + ":" + port);
    if (last_instance) {
        setTimeout(() => last_instance.pushMarkdown(), 1000);
    }
}
function InstantMarkdown() {
    let started = false;
    let server;
    let self = last_instance = this;
    this.initialise = function (callback) {
        if (!server) {
            server = new server_1.default({
                root: path.dirname(vscode.window.activeTextEditor.document.fileName),
                started() {
                    started = true;
                    if (vscode.workspace.getConfiguration("instantmarkdown").get("autoOpenBrowser")) {
                        openBrowser();
                    }
                }
            });
        }
    };
    let old_markdown = "";
    this.pushMarkdown = function () {
        let md = new MarkdownIt('default', {
            html: true,
            highlight: function (str, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(lang, str).value;
                    }
                    catch (__) { }
                }
                return '';
            }
        });
        var new_markdown = md
            .use(require('markdown-it-task-lists'))
            .use(require('markdown-it-sup'))
            .use(require('markdown-it-named-headers'))
            .use(require('markdown-it-plantuml'))
            .use(require('markdown-it-mathjax')())
            .render(vscode.window.activeTextEditor.document.getText());
        if (old_markdown !== "") {
            let send_markdown = '';
            for (let i = 0; i < new_markdown.length && send_markdown === ''; i++) {
                if (new_markdown[i] !== old_markdown[i]) {
                    send_markdown = new_markdown.substring(0, i) + '<span id="instant-markdown-cursor"></span>' + new_markdown.substring(i);
                    server.send(send_markdown);
                }
            }
            if (send_markdown === '') {
                server.send(new_markdown);
            }
        }
        else {
            server.send(new_markdown);
        }
        old_markdown = new_markdown;
    };
    let last_debounce = vscode.workspace.getConfiguration("instantmarkdown").get("debounce");
    let debouncedPush = debounce(this.pushMarkdown, last_debounce);
    this.update = function () {
        //check if the config has changed
        let curr_debounce = vscode.workspace.getConfiguration("instantmarkdown").get("debounce");
        if (curr_debounce !== last_debounce) {
            last_debounce = curr_debounce;
            debouncedPush = debounce(this.pushMarkdown, last_debounce);
        }
        if (started) {
            debouncedPush();
        }
        else {
            this.initialise(this.pushMarkdown);
        }
    };
    this.close = function () {
        if (vscode.workspace.getConfiguration("instantmarkdown").get("autoCloseServerAndBrowser")) {
            server.close();
            server = false;
            started = false;
        }
    };
}
function InstantMarkdownController(md) {
    var subscriptions = [];
    function update() {
        var editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        var doc = editor.document;
        if (doc.languageId === "markdown") {
            md.update();
        }
        else {
            md.close();
        }
    }
    vscode.window.onDidChangeActiveTextEditor(update, this, subscriptions);
    vscode.window.onDidChangeTextEditorSelection(update, this, subscriptions);
    md.update();
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map