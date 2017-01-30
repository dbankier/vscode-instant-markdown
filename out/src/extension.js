"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const server_1 = require("./server");
const path = require('path');
const open = require('opn');
const MarkdownIt = require('markdown-it');
var taskLists = require('markdown-it-task-lists');
function activate(context) {
    var instantMarkdown = new InstantMarkdown();
    var instantMarkdownController = new InstantMarkdownController(instantMarkdown);
    context.subscriptions.push(instantMarkdown);
    context.subscriptions.push(instantMarkdownController);
}
function InstantMarkdown() {
    let started = false;
    let server;
    let self = this;
    this.initialise = function (callback) {
        if (!server) {
            server = new server_1.default({
                started() {
                    started = true;
                    open("http://localhost:8090");
                    setTimeout(() => self.pushMarkdown(), 1000);
                }
            });
        }
    };
    this.pushMarkdown = function () {
        let md = new MarkdownIt();
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