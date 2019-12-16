# jsPlayer

You can start with
~~~
var p = new Player({src:'*SOURCE*'});
~~~
Or just
~~~
var p = new Player();
~~~
And drag & drop the media file you want to play

## Player Features
* Drag & Drop - media file AND subtitles file
* Drag & Drop media file AND subtitles file at the same time
* Change media source by paste URL
    1. Click on the player
    1. Ctrl+V
* Create Player instance/s by paste 
    1. Remove all Player instances from the HTML
    1. Copy URL/s to clipboard

        ######_Examples URLs:_
        ~~~
        https://mediamediamedia.com/video.mp4
        https://mediamediamedia.com/video3.mp4
        ~~~
    1. Paste (Ctrl+V) at the document
* Menu
    * Context event will trigger custom menu
        * Loop (toggle state)
        * Copy video URL
        * Copy video URL at current time