let socket = io();
socket.on('message', function (data) {
  $('<p>' + data + '</p>').appendTo($('body'));
});

socket.on('finishpart', function(data) {
  var name = data.split('public\\')[1];
  $('<p>本部分下载完成:<a target="_blank" href="/'+ name +'">地址</a></p>').appendTo($('body'));
});

socket.on('connect', function (data) {
  var url = 'http://quanben.io/n/' +  location.href.split('quanbenphantom/')[1]  + '/list.html';
  socket.emit('startquanben', url);
});

socket.on('disconnect', function() {
  window.location.reload();
});

socket.on('end', function () {
  $('.downloading').remove();
  $('<p>下载完成</p>').appendTo($('body'));
});