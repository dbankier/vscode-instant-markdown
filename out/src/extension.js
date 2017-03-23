"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const server_1 = require("./server");
const path = require('path');
const open = require('opn');
const hljs = require('highlight.js');
const MarkdownIt = require('markdown-it');
var taskLists = require('markdown-it-task-lists');
function activate(context) {
    var instantMarkdown = new InstantMarkdown();
    var instantMarkdownController = new InstantMarkdownController(instantMarkdown);
    context.subscriptions.push(instantMarkdown);
    context.subscriptions.push(instantMarkdownController);
    context.subscriptions.push(vscode.commands.registerCommand('instantmarkdown.openBrowser', openBrowser));
}
let last_instance;
function openBrowser() {
    open("http://localhost:8090");
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
        server.send(md.use(taskLists).render(vscode.window.activeTextEditor.document.getText()));
    };
    this.update = function () {
        if (started) {
            this.pushMarkdown();
        }
        else {
            this.initialise(this.pushMarkdown);
        }
    };
    this.close = function () {
        server.close();
        server = false;
        started = false;
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