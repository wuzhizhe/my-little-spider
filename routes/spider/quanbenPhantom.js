const phantom = require('phantom'),
    cheerio = require('cheerio');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
});

async function getContent(url, array, index, cb, length, repeat) {
    const instance = await phantom.create();
    const page = await instance.createPage();
    try {
        await page.on("onResourceRequested", function (requestData) {
        });

        await page.on('onResourceReceived', function(response) {
        });
        const status = await page.open(url);

        await sleep(2000);

        const content = await page.property('content');
        let $ = cheerio.load(content);
        let title = $('.headline').html();
        let novel = $('#content').html();
        console.log(url + ' title is : ' + title);
        if (repeat == 5) {
            await instance.exit();
            cb();
            return;
        }
        if (!novel || novel.indexOf('quanben.io') > -1) {
            await instance.exit();
            console.log(url + ' repeat ' + (repeat + 1) + ' times');
            getContent(url, array, index, cb, length, repeat + 1);
            return;
        }
        array.push({
            index,
            content: title + novel
        });
        await instance.exit();
        cb();
    } catch (err) {
        getContent(url, array, index, cb, length, repeat + 1);
        return;
    }


}

module.exports = getContent;