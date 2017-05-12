var express = require('express');
var router = express.Router();
var spide = require('./spider/index');
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/public', function(req, res, next)  {
    console.log(req.originalUrl);
    res.end('you stupid guy!');
});

router.get('/cnodelist', function (req, res, next) {
    spide.spideSite('http://item.jd.com/2350832.html')
        .then(function (data) {
            res.render('spider/spider', {data: data});
        }, function (err) {
            res.render('error',{
                message: err.info,
                error: err.err
            });
        });
});

router.get('/lewen8novel/:id', (req, res, next) => {
    let url = 'http://m.lewen8.com/'+ req.params.id +'.html'
    spide.getNovelPageList(url)
        .then((data) => {
            res.end(data);
        }, (err) => {

        })
});

router.get('/520novel/:id', (req, res, next) => {
    let url = 'http://m.520xs.la/'+ req.params.id;
    spide.get520Novel(url)
});

router.get('/rss.xml', function (req, res, next) {
    spide.getRss();
});

router.get('/quanbenio/:id', (req, res, next) => {
    let url = 'http://quanben.io/n/'+ req.params.id +'/list.html';
    spide.getQuanbenNovel(url, res);
    res.set('Content-Type', 'text/html');
    res.send('小说下载中，下载完毕后将在新页面打开。');
})

module.exports = router;
