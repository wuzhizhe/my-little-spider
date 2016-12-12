/**
 * Created by zhangzm on 2016-6-8.
 */
const superagent = require('superagent'),
    cheerio = require('cheerio'),
    EventProxy = require('eventproxy'),
    async = require('async'),
    fs = require('fs'),
    proxy = 'http://127.0.0.1:5656',
    _ = require('underscore'),
    DOMParser = require('xmldom').DOMParser;
let pageInfo = {};
let pages = [];
let articles = [];
let ep = new EventProxy();

require('superagent-proxy')(superagent);

function spideSite(url) {
    getPageInfo(url);
    return new Promise((resolve, reject) => {

    });
}
/**
 * 获取网站目前总页数
 * @param url
 */
function getPageInfo(url) {
    superagent.get(url)
        .end((err, res) => {
            assert.equal(err, null);
            let $ = cheerio.load(res.text);
            let pageDom = $('.pagination').find('a').last().attr('href');
            pageInfo.pageCount = parseInt(pageDom.split('page=')[1]) - 1;
            makePageArray();
            getArticles();
        });
}

/**
 * 制作要获取的页面url数组
 */
function makePageArray() {
    for (let i = 0; i < pageInfo.pmpageCount; i++) {
        pages.push('https://cnodejs.org/?tab=all&page=' + i);
    }
}

/**
 * 获取所有的文章信息，包括文章名，作者以及文章链接
 */
function getArticles() {
    console.log(pages.length);
    let atime = new Date().getTime();
    let startTime = atime;
    async.mapLimit(pages, 10, (item, callback) => {
        let btime = new Date().getTime();
        console.log(btime - atime + '   ' + item);
        atime = btime;
        getArticle(item, callback);
    }, (err, results) => {
        let insertTime = new Date().getTime();
        console.log('all spide used time = '+ (insertTime - startTime) + 'ms');
        insertMany({
            doc: 'spider',
            data: articles
        }, function (err, result) {
            console.log('all insert used time = '+ (new Date().getTime() - insertTime) + 'ms');
            makeRssXmlFile();
        });
    });
}

/**
 * 根据文章URL抓取数据，解析数据，获取url,author
 * @param url
 * @param callback
 */
function  getArticle(url, callback) {
    superagent.get(url)
        .end((err, res) => {
            let errorMessage = 'sorry, i am really stupid, error happened! please try again. o(╥﹏╥)o';
            if (!!err) {
                callback(err, url);
            }

            try {
                let $ = cheerio.load(res.text);
                let list = $('#topic_list .topic_title');
                for (let i = 0; i < list.length; i++) {
                    let _item = $(list[i]);
                    let _temp = {
                        title: _item.attr('title'),
                        href: 'https://cnodejs.org' + _item.attr('href'),
                        author: _item.parents('.cell').find('.user_avatar').attr('href').substr(6)
                    };
                    articles.push(_temp);
                }
            } catch (e) {
                console.log(e);
            } finally {
                callback(null, url);
            }
        });
}

function makeRssXmlFile() {
    let xml = new DOMParser().parseFromString(
        '<?xml version="1.0" encoding="UTF-8" ?>' +
        '<rss version="2.0">' +
            '<channel>' +
            '</channel>' +
        '</rss>'
        ,'text/xml');
    let channel = xml.getElementsByTagName('channel')[0];
    let startTime = new Date().getTime();
    for (let i = 0; i < articles.length; i++) {
        let item = xml.createElement('item');
        let title = xml.createElement('title');
        title.textContent = articles[i].title;
        let link = xml.createElement('link');
        link.textContent = articles[i].href;
        let des = xml.createElement('description');
        des.textContent = articles[i].author;
        item.appendChild(title);
        item.appendChild(link);
        item.appendChild(des);
        channel.appendChild(item);
    }
    fs.writeFile('rss.xml', xml, 'utf8', (err) => {
        if(!err) {
            console.log('file saved!');
        }
    });
    console.log('used time ' + (new Date().getTime() - startTime));
}

/*================================================小说分割线 start================================================*/

function makeNovelPageArray($, chapterlist) {
    let novelList = [];
    // for (let i = 0; i < 1; i++) {
    for (let i = 0; i < chapterlist.length; i++) {
        let pages = chapterlist[i].children;
        for (let j = 0; j < pages.length; j++) {
            let tempPage = pages[j];
            let _href = null;
            if (tempPage.type == 'tag' && tempPage.name == 'p') {
                let _href = 'http://m.lewen8.com' + $(tempPage).find('a').attr('href');
                novelList.push(_href);
            }
        }
    }
    return novelList;
}

function  getNovel(url, contentArray, index, callback, count) {
    superagent.get(url)
        .proxy(proxy)
        .end( (err, res) => {
            count++;
            if (err) {
                if (count === 10) return;
                getNovel(url, contentArray, index, callback)
                return;
            }
            try {
                let $ = cheerio.load(res.text);
                let title = $("#top").find("span").text();
                let dom = cheerio.load('<div></div><h2 class="title"></h2><div class="content"></div></div>')
                dom('h2.title').text(title);
                let content = $('#chaptercontent').html();
                content = cheerio.load(content);
                content('p').remove();
                dom('div.content').append(content.html());
                contentArray.push({
                    index: index,
                    content: dom.html()
                });
            } catch (e) {
                console.error(e);
            } finally {
                callback(null, url);
            }
        } )
}

function makeHtmlContent(cArray) {
    cArray = _.sortBy(cArray, 'index');
    let content = '';
    for ( let i = 0; i < cArray.length; i++) {
        content += cArray[i].content;
    }
    return content;
}


function  getNoveText(chapterlist, resolve, reject) {
    let index = 0;
    let contentArray = [];
    let atime = new Date().getTime();
    let startTime = atime;
    async.mapLimit(chapterlist, 10, (item, callback) => {
        let btime = new Date().getTime();
        console.log(btime - atime + '   ' + item);
        atime = btime;
        getNovel(item, contentArray, index++, callback, 0);
    }, (err, results) => {
        let insertTime = new Date().getTime();
        console.log('all spide used time = '+ (insertTime - startTime) + 'ms');
        resolve(makeHtmlContent(contentArray));
    });



}

function getNovelPageList(url) {
    return new Promise((resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                assert.equal(err, null);
                let $ = cheerio.load(res.text);
                let chapterlist = $('.chapterlist');
                let novelArray = makeNovelPageArray($, chapterlist);
                getNoveText(novelArray, resolve, reject);

            });
    });
}


/*================================================小说分割线 end=================================================*/


module.exports = {
    spideSite,
    getNovelPageList
};

makeRssXmlFile();