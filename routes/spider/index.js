/**
 * Created by zhangzm on 2016-6-8.
 */
const superagent = require('superagent'),
    cheerio = require('cheerio'),
    EventProxy = require('eventproxy'),
    async = require('async'),
    fs = require('fs'),
    opn = require('opn'),
    proxy = 'http://127.0.0.1:5656',
    // proxy = 'http://10.18.8.21:8081',
    _ = require('underscore'),
    DOMParser = require('xmldom').DOMParser;
let socket = require('../socket/novel');
let pageInfo = {};
let pages = [];
let articles = [];
let ep = new EventProxy();
let getContentByPhantom = require('./quanbenPhantom')

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
            let $ = cheerio.load(res.text, {decodeEntities: false});
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
                let $ = cheerio.load(res.text, {decodeEntities: false});
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

/*===============================================lewen8小说分割线 start============================================*/

/**
 * 从目录页获取到的数据生成每一章的访问url
 * @param $
 * @param chapterlist
 * @returns {Array}
 */
function makeNovelPageArray($, chapterlist) {
    let novelList = [];
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

/**
 * 获取页面中的title与content生成小说每一章的名字与正文
 * @param url
 * @param contentArray
 * @param index
 * @param callback
 * @param count
 */
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
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let title = $("#top").find("span").text();
                let dom = cheerio.load('<div></div><h2 class="title"></h2><div class="content"></div></div>')
                dom('h2.title').text(title);
                let content = $('#chaptercontent').html();
                content = cheerio.load(content, {decodeEntities: false});
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

/**
 * 将获取到的所有字符排序，然后连接生成HTML字符串
 * @param cArray
 * @returns {string}
 */
function makeHtmlContent(cArray, novelName, index) {
    cArray = _.sortBy(cArray, 'index');
    let content = '';
    for ( let i = 0; i < cArray.length; i++) {
        content += cArray[i].content;
    }
    let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title><Document></Document></title></head><body></body></html>';
    let dom = cheerio.load(html, {decodeEntities: false});
    dom('body').append(content);
    let name = new Date().getTime();
    if (novelName && index) {
        name = novelName + '' + index;
    }

    let filePath = baseDir + '\\public\\' + name + '.html';
    fs.closeSync(fs.openSync(filePath, 'w'));
    fs.writeFileSync(filePath, dom.html());
    socket.emitPartMessage(filePath);
    setTimeout(() => {
        // opn(filePath);
    }, 3000)
    return content;
}

/**
 * 用异步调用方式获取每一页的标题与数据
 * @param chapterlist
 * @param resolve
 * @param reject
 */
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
        console.log('抓取这小说一共用了 '+ (insertTime - startTime) + ' 毫秒');
        res.end(makeHtmlContent(contentArray));
    });
}

/**
 * 从目录页获取章节列表
 * @param url
 * @returns {Promise}
 */
function getNovelPageList(url) {
    return new Promise((resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                assert.equal(err, null);
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let chapterlist = $('.chapterlist');
                let novelArray = makeNovelPageArray($, chapterlist);
                getNoveText(novelArray, resolve, reject);

            });
    });
}


/*================================================小说分割线 end=================================================*/


/*================================================520 novel start==============================================*/

/**
 * 根据novelId获取所有的url
 * @param url
 */
function get520NovelUrls(url) {
    return new Promise( (resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                assert.equal(err, null);
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let prefix = 'http://m.520xs.la';
                let urlArray = [];
                let chapterlist = $('.pageselectlist')[0];
                for (let i = 0; i < chapterlist.children.length; i++) {
                    let _url = prefix + $(chapterlist.children[i]).attr('value');
                    urlArray.push(_url)
                }
                resolve(urlArray);
            });
    });

}

function get520NovelCollect(url) {
    let pageList = [],
        prefix = 'http://m.520xs.la';
    return new Promise( (resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                assert.equal(err, null);
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let chapterList = [];
                let novelList = $('#chapterlist')[0].children;
                for (let i = 0; i < novelList.length; i++) {
                    let href = prefix + $(novelList[i]).attr('onclick').split("location.href='")[1];
                    console.log(href);
                    chapterList.push(href);
                }
                resolve(chapterList);
            });
    });
}

function getNovelContent(url) {
    return new Promise( (resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                if (err) {
                    resolve('');
                }
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let content = $('#readercontainer').html();
                content = content.replace('<div style="display:none;">', '');
                content = content.replace('</div>', '');
                resolve(content);
            });
    });
}

function run(fn, url) {
    var g = fn(url);
    function next(preData) {
        g.next(preData).value.then(function(nowData) {
            next(nowData);
        });
    }
    next(null);
}

function get520Novel(url) {
    run(get520Novels, url);
}


function* get520Novels(url) {
    let allPages = [];
    let urls = yield get520NovelUrls(url);
    let content = '';
    for (let i = 0; i < urls.length; i++) {
        let pages = yield get520NovelCollect(urls[i]);
        allPages = allPages.concat(pages);
    }
    for (let i = 0; i < allPages.length; i++) {
        let pageContent = yield getNovelContent(allPages[i]);
        content += pageContent;
    }
    let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title><Document></Document></title></head><body></body></html>';
    let dom = cheerio.load(html, {decodeEntities: false});
    dom('body').append(content);
    let time = new Date().getTime();
    let filePath = baseDir + '\\public\\' + time + '.html';
    fs.closeSync(fs.openSync(filePath, 'w'));
    fs.writeFileSync(filePath, dom.html());
    // return content;
}

/*================================================520 novel endt==============================================*/


/*================================================quanben novel endt==============================================*/

// 下载全本小说网的小说

async function getQuanbenNovel(url, res) {
    let novelList = await getQuanbenNovelList(url);
    // return getAllNovelContent(novelList)
    getAllNovelContentByAsyncMaplist(novelList, res);
}

function getAllNovelContentByAsyncMaplist(novelList, res) {
    let contentArray = [];
    let index = 0;
    let atime = new Date().getTime();
    let startTime = atime;
    async.mapLimit(novelList, 10, (item, callback) => {
        let btime = new Date().getTime();
        console.log(btime - atime + '   ' + item);
        atime = btime;
        getChapterContent(item, contentArray, index++, callback, 0);
    }, (err, results) => {
        let insertTime = new Date().getTime();
        console.log('抓取这小说一共用了 '+ (insertTime - startTime) + ' 毫秒');
        makeHtmlContent(contentArray);
        // res.end('小说下载完毕，3秒后在新页面打开！');
    });
}

function getChapterContent(url, contentArray, index, callback) {
    console.log(url)
    return new Promise( (resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                let thisErr = null;
                try {
                    if (err) {
                        reject(err);
                    }
                    if (!res) {
                        resolve('');
                        return;
                    }
                    let $ = cheerio.load(res.text, {decodeEntities: false});
                    let title = $('.headline');
                    let content = cheerio.load($('.articlebody').html(), {decodeEntities: false});
                    content('script').remove();
                    content('ins').remove();
                    contentArray.push({
                        index,
                        content: title.html() + content.html()
                    });
                } catch (err) {
                    thisErr = err;
                    getChapterContent(url, contentArray, index, callback)
                } finally {
                    if (!thisErr) callback();
                }
                
            });
    });
}

async function getAllNovelContent(novelList) {
    let html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title><Document></Document></title></head><body></body></html>';
    let dom = cheerio.load(html, {decodeEntities: false});
    let content = '';
    for (let i = 0, length = novelList.length; i < length; i++) {
        content += await getQuanbenNovelChapterContent(novelList[i]);
    }
    dom('body').append(content);
    let time = new Date().getTime();
    let filePath = baseDir + '\\public\\' + time + '.html';
    fs.closeSync(fs.openSync(filePath, 'w'));
    fs.writeFileSync(filePath, dom.html());
    return content;
}

//获取小说目录列表
function getQuanbenNovelList(url) {
    let novelList = [];
    return new Promise( (resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                if (err) {
                    reject(err);
                }
                assert(res != null);
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let allList = $('.list3 li');
                let novelName = $('h1').html();
                for (let i = 0, length = allList.length; i < length; i++) {
                    let item = allList[i];
                    let href = $(item).find('a').attr('href');
                    novelList.push('http://quanben.io' + href);
                }
                resolve({
                    novelList,
                    novelName
                });
            });
    });
}

//获取当前章节内容
function getQuanbenNovelChapterContent(url) {
    console.log(url)
    return new Promise( (resolve, reject) => {
        superagent.get(url)
            .proxy(proxy)
            .end((err, res) => {
                if (err) {
                    reject(err);
                }
                if (!res) {
                    resolve('');
                    return;
                }
                let $ = cheerio.load(res.text, {decodeEntities: false});
                let title = $('.headline');
                let content = cheerio.load($('.articlebody').html(), {decodeEntities: false});
                content('script').remove();
                content('ins').remove();
                resolve(title.html() + content.html());
            });
    });
}

/*=========================使用phantomjs抓取全本网 start===============================*/

async function getNovelByPhantom(url) {
    let data = await getQuanbenNovelList(url);
    let novelList = data.novelList;
    let novelName = data.novelName;
    let regex_num_set = /&#(\w+);/g;
    let size = 100;
    // novelName = novelName.replace(regex_num_set, function(_, $1) {
    //     var a = parseInt('0' + $1);
    //     return String.fromCharCode(a);
    // });
    socket.emitMessage('小说名：' + novelName + ' ,全篇一共 ' + novelList.length + ' 章');
    let i = 0, j = 0;
    let _end = i + size;
    while (i != novelList.length) {
        j++;
        if (_end <= novelList.length) {
            let tempArray = novelList.slice(i, _end);
            socket.emitMessage('正在下载小说 ' + i + '-' + _end + ' 章');
            await getQuanbenByPhantom(tempArray, novelName, j);
        }
        if (_end == novelList.length) break;
        _end = (_end +  size >= novelList.length ) ? novelList.length : _end +  size;
        i += size;
    }
    socket.emitEndMessage();

}

function getQuanbenByPhantom(novelList, novelName, fileIndex) {
    return new Promise((res, rej) => {
        let contentArray = [];
        let index = 0;
        let atime = new Date().getTime();
        let startTime = atime;
        async.mapLimit(novelList, 5, (item, callback) => {
            let btime = new Date().getTime();
            // console.log(btime - atime + '   ' + item);
            atime = btime;
            getContentByPhantom(item, contentArray, index++, callback, novelList.length, 0);
        }, (err, results) => {
            let insertTime = new Date().getTime();
            console.log('抓取这小说一共用了 '+ (insertTime - startTime) + ' 毫秒');
            let content = makeHtmlContent(contentArray, novelName, fileIndex);
            res('');
        });
    });
}

/*=========================使用phantomjs抓取全本网 end===============================*/

module.exports = {
    spideSite,
    getNovelPageList,
    get520Novel,
    getQuanbenNovel,
    getNovelByPhantom
};

// makeRssXmlFile();