(function(){
    /**
     * @See https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types
     */
    const VALID_EXTENSION = {'mp3':'audio','m4a':'audio','mp4':'video','mkv':'video'};
    const VALID_MIME_TYPE = {'audio/mp3':'mp3','video/mp4':'mp4','video/x-matroska':'mkv'};
    const VALID_MIME_TYPE_EXCEPTIONS = ['video/x-matroska'];
    const VALID_SUBTITLE_TYPE = ['srt'];
    const LOCAL_MEDIA_PATH = './media/';
    const PLAYER_ID_ATTR = 'player-id';
    const AUTOPLAY = false;
    const TIME_FORMAT = '00:00:00';
    const DEFAULT_MUTED = false;
    const JUMP_IN_TIME = 10;
    const JUMP_IN_VOLUME = 0.1;
    const DEFAULT_VOLUME = 0.2;
    const CONTROLS_CLASS_NAMES = ['player-controls','player-controls-buttons','timeline','timeline-container','player-btn','volume'];
    const PLAYER_NOTES = {
        404:{type:'error',title:'404',message:"Media source not exists"},
        generalError:{type:'error',title:'Error',message:"Can't play this video"},
        unsupportedVideoFile:{type:'error',title:'Unsupported Video Format',message:"Player does not support <strong>%s</strong> format",data:[]},
    };

    let playerInstances = {};
    let PlayerHelper = (function(){
        let Global = (function(){
            return {
                Date:(function(){
                    function addZero(num){ return ('0'+num).substr(-2); }
                    return {
                        HumanToSeconds:function(hms){
                            let a = hms.split(':');
                            return (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
                        },
                        secondsToDate:function(s){
                            s = parseInt(s,10);
                            let hours = Math.floor(s / 3600);
                            let minutes = Math.floor(s / 60);
                            let secs = s - (minutes * 60);
                            return addZero(hours)+':'+addZero(minutes)+':'+addZero(secs);
                        }
                    }
                })(),
                subtitles:function(player){
                    return {
                        ontimeupdate:function(){
                            let _subtitles = Global.getPlayerInstance(player).subtitles;
                            let currentTime = Number(player.currentTime.toFixed(3));
                            let subtitleElem = player.parentElement.querySelector('.subtitles-container .subtitles');
                            let text = '';
                            for(let startTime in _subtitles){
                                if(startTime <= currentTime && currentTime < _subtitles[startTime].endTime){
                                    text = _subtitles[startTime].text;
                                    break;
                                }
                            }
                            subtitleElem.innerHTML = text;
                        },
                        addToPlayerInstance:function(text){
                            let reader = new FileReader();
                            reader.onload = function(event){
                                let arr = event.target.result.split('\n\r');
                                let subtitles = {};
                                arr.map(function(row){
                                    let rows = row.trim().split('\n');
                                    let times = rows[1].split(' --> ');
                                    times[0] = Global.Date.HumanToSeconds(times[0].replace(',','.'));
                                    times[1] = Global.Date.HumanToSeconds(times[1].replace(',','.'));
                                    rows.splice(0,2);
                                    subtitles[times[0]] = {endTime:times[1], text:rows.join('<br />')};
                                });
                                Global.getPlayerInstance(player).subtitles = subtitles;
                            };
                            reader.readAsText(text,'UTF-8');
                        }
                    }
                },
                resetPlayer:function(player,options){
                    if(typeof(options.src)!=='undefined' && options.src){
                        Global.playerNotes(player).removeAll();
                        this.checkPlayerSrc(player,options.src);
                    }
                },
                checkPlayerSrc:function(player,src){
                    let http = new XMLHttpRequest();
                    http.open('HEAD',src);
                    http.onreadystatechange = function() {
                        if (this.readyState === this.DONE) {
                            if(this.status===200) Global.setPlayerSource(player,{src:src});
                            else if(this.status===404) Global.playerNotes(player,PLAYER_NOTES['404']).messageFormat();
                        }
                    };
                    http.send();
                },
                playerSupportType:function(player,obj){
                    return {
                        isSupported:function(){
                            // This is for subtitles
                            if(obj.kind==='file' && obj.type==='') return true;

                            if(VALID_MIME_TYPE_EXCEPTIONS.indexOf(obj.type)>-1) return (obj.type).toLowerCase();
                            let valid = (['probably','maybe'].indexOf(player.canPlayType(obj.type).toLowerCase())>-1);
                            return (valid && Object.keys(VALID_MIME_TYPE).indexOf(obj.type)>-1) ? (obj.type).toLowerCase() : false;
                        },
                        showNote:function(){
                            if(this.isSupported()) Global.playerNotes(player,PLAYER_NOTES.unsupportedVideoFile).removeAll();
                            else Global.playerNotes(player,PLAYER_NOTES.unsupportedVideoFile).messageFormat([obj.type]);
                        }
                    }
                },
                playOrPause:function(player){
                    player.parentElement.querySelector('.play-pause').className =
                        'player-btn play-pause fas fa-' + (player.paused ? 'pause' : 'play');
                    player.paused ? player.play() : player.pause();
                },
                setVolumeIcon:function(player){
                    let volumeIcon = '';
                    if(player.volume>=.6) volumeIcon = 'up';
                    else if(player.volume>=.2) volumeIcon = 'down';
                    else volumeIcon = 'off';

                    let className = 'player-btn toggle-mute fas fa-volume-';
                    className+=(player.muted ? 'mute' : volumeIcon);
                    player.parentElement.querySelector('.toggle-mute').className = className;
                },
                updateVolume:function(player,dir){
                    let v = player.volume;
                    if(dir) v+=JUMP_IN_VOLUME;
                    else v-=JUMP_IN_VOLUME;
                    if(v>=0 && v<=1){
                        player.volume = v;
                        player.parentElement.querySelector('.volume').value = v;
                    }
                },
                getPlayerInstance:function(player){
                    return playerInstances[player.getAttribute(PLAYER_ID_ATTR)];
                },
                playerNotes:function(player,data){
                    let noteContainer;
                    let note;
                    function initNoteContainer(){
                        noteContainer = player.parentElement.querySelector('.player-note-container');
                        if(!noteContainer){
                            noteContainer = document.createElement('div');
                            noteContainer.tabIndex = -1;
                            noteContainer.className = 'player-note-container';
                        }else{
                            noteContainer.innerHTML = '';
                        }
                        note = document.createElement('div');
                        note.className = 'player-note';
                    }
                    return {
                        removeAll:function(){
                            player.parentElement.querySelectorAll('.player-note-container').forEach(function(el){
                                el.remove();
                            });
                        },
                        messageFormat:function(params){
                            initNoteContainer();
                            note.classList.add('message');
                            let html = '';
                            if(data.title) html+='<h2>'+data.title+'</h2>';
                            if(data.message){
                                let msg = data.message;
                                if(params){
                                    msg = '';
                                    data.message.split('%s').forEach(function(text,index){
                                        msg+=text+(params[index] || '');
                                    });
                                }
                                console.log(params,msg);
                                html+='<p>'+msg+'</p>';
                            }
                            note.innerHTML = html;

                            noteContainer.appendChild(note);
                            player.parentElement.appendChild(noteContainer);
                            noteContainer.classList.add('active');
                        },
                        iconFormat:function(){
                            if(player.tagName.toLowerCase()==='audio') return false;
                            let playerTimeout = Global.getPlayerInstance(player).playerTimeout;
                            initNoteContainer();

                            if(['play','pause'].indexOf(data)>-1){
                                note.className += ' fas fa-'+data;
                            }
                            noteContainer.appendChild(note);

                            if(['play'].indexOf(data)>-1){
                                if(playerTimeout.notification) clearTimeout(playerTimeout.notification);
                                playerTimeout.notification = setTimeout(function(){
                                    let playerNote = noteContainer.querySelector('.player-note').className;
                                    if(playerNote.indexOf('fa-play')===-1) return false;
                                    noteContainer.classList.remove('active');

                                    if(playerTimeout.notification2) clearTimeout(playerTimeout.notification2);
                                    playerTimeout.notification2 = setTimeout(function(){
                                        player.focus();
                                        let playerNote = noteContainer.querySelector('.player-note').className;
                                        if(playerNote.indexOf('fa-play')===-1) return false;
                                        noteContainer.remove();
                                    },700);
                                },1000);
                            }
                            player.parentElement.appendChild(noteContainer);
                            noteContainer.classList.add('active');
                        }
                    }
                },
                FullScreen:function(player){
                    return {
                        isActive:function(){
                            return (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
                        },
                        btnVisual:function(){
                            let btn = player.parentElement.querySelector('.toggle-fullscreen');
                            let c = this.isActive() ? 'compress' : 'expand';
                            btn.className = 'player-btn toggle-fullscreen fas fa-'+c;
                        },
                        toggleFullscreen:function(){
                            this.isActive() ? this.exit() : this.enter();
                        },
                        exit:function(){
                            try{
                                if (document.exitFullscreen) document.exitFullscreen();
                                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                                else if (document.msExitFullscreen) document.msExitFullscreen();
                            }catch{}
                            player.parentElement.classList.remove('fullscreen');
                            Global.getPlayerInstance(player).playerSettings.fullscreen = false;
                        },
                        enter:function(){
                            let elem = player.parentElement;
                            elem.classList.add('fullscreen');
                            Global.getPlayerInstance(player).playerSettings.fullscreen = true;
                            try{
                                if (elem.requestFullscreen) elem.requestFullscreen();
                                else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
                                else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                                else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
                            }catch{}
                        }
                    }
                },
                toggleControlsVisibility:function(player,show,event){
                    let pTime = this.getPlayerInstance(player).playerTimeout.controls;
                    let pc = player.parentElement.querySelector('.player-controls').classList;
                    let stopFunc = false;

                    if(player.paused){
                        if(pTime) clearTimeout(pTime);
                        pc.add('show');
                        return true;
                    }

                    if(event){
                        CONTROLS_CLASS_NAMES.map(function(className){
                            if(event.target.className.indexOf(className)>-1){
                                stopFunc = true;
                                if(pTime) clearTimeout(pTime);
                                pc.add('show');
                            }
                        });
                        if(stopFunc) return true;
                        else if(event.target.hasAttribute('player-id')){
                            pc.add('show');
                            show = false;
                        }
                    }

                    if(show){
                        pc.add('show');
                    }else{
                        if(pTime) clearTimeout(pTime);
                        this.getPlayerInstance(player).playerTimeout.controls = setTimeout(function(){
                            pc.remove('show');
                        },1500);
                    }
                },
                setPlayerSource:function(player,options){
                    let mimeType = Global.getPlayerInstance(player).playerSettings.mediaMimeType;
                    player.innerHTML = '<source src="'+options.src+'" type="'+mimeType+'">';
                    player.load();
                }
            }
        })();
        let HandleButtons = (function(player,playerControls){
            return {
                volume:function(){
                    let btn = document.createElement('input');
                    btn.className = 'volume';
                    btn.type = 'range';
                    btn.disabled = player.muted;
                    btn.min = '0';btn.max = '1';btn.step = '0.1';
                    btn.value = player.volume;
                    btn.addEventListener('input',function(e){
                        player.volume = e.target.value;
                        Global.setVolumeIcon(player);
                    });
                    let parent = document.createElement('div');
                    parent.className = 'volume-container';
                    parent.appendChild(btn);
                    playerControls.appendChild(parent);
                },
                toggleFullscreen:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn toggle-fullscreen fas fa-expand';
                    btn.addEventListener('click',function(){
                        let f = Global.FullScreen(player);
                        let isActive = f.isActive();
                        isActive ? f.exit() : f.enter();
                    });
                    playerControls.appendChild(btn);
                },
                displayDuration:function(){
                    let btn = document.createElement('div');
                    btn.className = 'duration';
                    btn.innerHTML = '<span class="player-current-time">'+TIME_FORMAT+'</span> <span>/</span> <span class="player-total-time">'+TIME_FORMAT+'</span>';
                    playerControls.appendChild(btn);
                },
                playbackRate:function(){
                    let btn = document.createElement('select');
                    btn.className = 'player-btn ignore-arrow-events';
                    let options = [0.25,0.5,0.75,1,1.25,1.5,1.75,2];
                    for(let i in options){
                        let o = document.createElement('option');
                        o.innerText = options[i].toString();
                        if(options[i]===1) o.selected = true;
                        btn.appendChild(o);
                    }
                    btn.addEventListener('change',function(e){
                        player.playbackRate = e.target.value;
                    });
                    playerControls.appendChild(btn);
                },
                toggleMute:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn toggle-mute fas fa-volume-' + (player.muted ? 'mute' : 'up');
                    btn.addEventListener('click',function(){
                        player.muted = !player.muted;
                        Global.setVolumeIcon(player);
                        playerControls.querySelector('.volume').disabled = player.muted;
                    });
                    playerControls.appendChild(btn);
                },
                JumpForward:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn fas fa-forward';
                    btn.title = 'Jump +'+JUMP_IN_TIME;
                    btn.addEventListener('click',function(){
                        player.currentTime+=JUMP_IN_TIME;
                    });
                    playerControls.appendChild(btn);
                },
                JumpBackward:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn fas fa-backward';
                    btn.title = 'Jump -'+JUMP_IN_TIME;
                    btn.addEventListener('click',function(){
                        player.currentTime-=JUMP_IN_TIME;
                    });
                    playerControls.appendChild(btn);
                },
                playPause:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn play-pause fas fa-play';
                    btn.addEventListener('click',function(){
                        Global.playOrPause(player);
                    });
                    playerControls.appendChild(btn);
                }
            }
        });
        function HandleEvents(player,playerContainer){
            player.addEventListener('timeupdate',function(e){
                let player = e.target;
                let dur = player.duration;
                player.parentElement.querySelector('.timeline').style.width = ((player.currentTime / dur) * 100) + '%';
                playerContainer.querySelector('.player-current-time').innerText = Global.Date.secondsToDate(player.currentTime);
                Global.subtitles(player).ontimeupdate();
            });
            player.addEventListener('canplaythrough',function(e){
                console.log('e',e);
            });
            player.addEventListener('error',function(e){
                Global.playerNotes(player,PLAYER_NOTES.generalError).messageFormat();
                console.log('e',e);
            });
            player.addEventListener('loadeddata',function(e){
                if(player.readyState >= 2){
                    player.currentTime = 0;
                    player.parentElement.querySelector('.timeline').style.width = '0%';
                    player.parentElement.querySelector('.timeline').style.width = TIME_FORMAT;
                    playerContainer.querySelector('.player-total-time').innerText = Global.Date.secondsToDate(player.duration);
                    if(AUTOPLAY) Global.playOrPause(player);
                }
            });
            playerContainer.addEventListener('fullscreenchange',function(){
                Global.FullScreen(player).btnVisual()
            });
            playerContainer.addEventListener('fullscreenerror',function(e){
                console.error('fullscreenerror',e);
            });
            player.addEventListener('play',function(e){
                Global.playerNotes(player,e.type).iconFormat();
                Global.toggleControlsVisibility(player,false);
            });
            player.addEventListener('pause',function(e){
                Global.playerNotes(player,e.type).iconFormat();
            });
            player.addEventListener('ended',function(e){
                playerContainer.querySelector('.play-pause').className = 'player-btn play-pause fas fa-undo-alt';
            });
            player.addEventListener('volumechange',function(e){
                Global.setVolumeIcon(player);
                playerContainer.querySelector('.volume').disabled = player.muted;
            });
            player.addEventListener('progress',function(e){
                console.log('player.networkState',player.networkState);
            });
            ['dragstart','drag','dragend','dragenter','dragover','drop'].map(function(evName){
                playerContainer.addEventListener(evName,function(e){
                    e.preventDefault();
                    if(e.type==='dragover'){
                        Global.playerSupportType(player,e.dataTransfer.items[0]).showNote();
                        return true;
                    }
                    if(e.type!=='drop') return true;
                    let files = e.dataTransfer.files;

                    for(let i=0; i<files.length; i++){
                        let src = files[i].name;
                        // Subtitles
                        let ex = src.substr(src.lastIndexOf('.')+1);
                        if(VALID_SUBTITLE_TYPE.indexOf(ex)>-1){
                            Global.subtitles(player).addToPlayerInstance(files[i]);
                        }
                        // Media
                        else{
                            let mimeType = Global.playerSupportType(player,e.dataTransfer.items[i]).isSupported();
                            if( mimeType ){
                                Global.getPlayerInstance(player).playerSettings.mediaMimeType = mimeType;
                                if(src.indexOf('http://')===-1 && src.indexOf('https://')===-1){
                                    Global.resetPlayer(player,{
                                        src:LOCAL_MEDIA_PATH+src
                                    });
                                }
                            }
                        }
                    }
                });
            });

            ['mouseover','mouseout','mousemove'].map(function(ev_name){
                playerContainer.addEventListener(ev_name,function(e){
                    if(player.paused){
                        Global.toggleControlsVisibility(player,true,e);
                    }else if(e.type==='mousemove'){
                        Global.toggleControlsVisibility(player,false,e);
                    }
                });
            });

            playerContainer.addEventListener('dblclick',function(){
                Global.FullScreen(player).toggleFullscreen();
            });

            playerContainer.addEventListener('keyup',function(e){
                let ignoreArrowEvents = e.target.classList.contains('ignore-arrow-events');
                let keyCode = e.keyCode || e.which;
                if(keyCode===37 && !ignoreArrowEvents) player.currentTime-=JUMP_IN_TIME;
                else if(keyCode===39 && !ignoreArrowEvents) player.currentTime+=JUMP_IN_TIME;
                else if(keyCode===38 && !ignoreArrowEvents) Global.updateVolume(player,1);
                else if(keyCode===40 && !ignoreArrowEvents) Global.updateVolume(player,0);
                else if(keyCode===77) player.muted=!player.muted;
                else if(keyCode===32) playerContainer.querySelector('.play-pause').dispatchEvent(new Event('click'));
                else if(keyCode===70) Global.FullScreen(player).toggleFullscreen();
                // console.log('keyCode',keyCode);
            });
        }
        function PlayerControls(player,playerContainer){

            let subtitleContainer = document.createElement('div');
            subtitleContainer.className = 'subtitles-container';
            subtitleContainer.tabIndex = -1;
            subtitleContainer.innerHTML = '<div class="subtitles"></div>';
            playerContainer.appendChild(subtitleContainer);

            let timelineContainer = document.createElement('div');
            timelineContainer.className = 'timeline-container';
            timelineContainer.addEventListener('click',function(e){
                let rect = timelineContainer.getBoundingClientRect();
                let percent = ((e.clientX - rect.left) / rect.width) * 100;
                let segment = (player.duration / 100);
                try{
                    player.currentTime = segment * percent;
                }catch{}
            });

            let timeline = document.createElement('div');
            timeline.className = 'timeline';
            timeline.tabIndex = -1;
            timelineContainer.appendChild(timeline);

            let playerControls = document.createElement('div');
            playerControls.className = 'player-controls show';
            playerContainer.appendChild(playerControls);
            playerControls.appendChild(timelineContainer);

            let playerControlsButtons = document.createElement('div');
            playerControlsButtons.className = 'player-controls-buttons';
            playerControls.appendChild(playerControlsButtons);

            let handleButtons = HandleButtons(player,playerControlsButtons);
            handleButtons.playPause();
            handleButtons.JumpBackward();
            handleButtons.JumpForward();
            handleButtons.displayDuration();
            handleButtons.playbackRate();
            handleButtons.toggleFullscreen();
            handleButtons.toggleMute();
            handleButtons.volume();
        }
        return {
            setPlayerInstance:function(_this){
                playerInstances[_this.player.getAttribute(PLAYER_ID_ATTR)] = _this;
            },
            Events:(function(){
                return {
                    onResize:function(){}
                }
            })(),
            build:function(settings){
                let id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                if(settings.mediaType==='') settings.mediaType = 'video';
                let player = document.createElement(settings.mediaType);
                if(settings.src!=='') Global.setPlayerSource(player,{src:settings.src});
                player.tabIndex = -1;
                player.volume = DEFAULT_VOLUME;
                player.muted = DEFAULT_MUTED;
                player.setAttribute(PLAYER_ID_ATTR,id);

                let playerContainer = document.createElement('div');
                playerContainer.className = 'player-container';
                playerContainer.appendChild(player);

                HandleEvents(player,playerContainer);
                PlayerControls(player,playerContainer);

                document.body.appendChild(playerContainer);
                return player;
            },
            prepareSettings:function(params){
                params = params || {};
                params.src = typeof(params.src)==='string' ? params.src : '';
                params.mediaType = '';
                if(params.src!==''){
                    let src = params.src;
                    if(src.indexOf('?')>-1){
                        src = src.substr(0,src.indexOf('?'));
                    }
                    src = src.substr(src.lastIndexOf('.')+1);
                    params.mediaType = VALID_EXTENSION[ src ];
                }
                return params;
            }
        }
    })();
    function Player(params){
        params = params || {};
        try{
            let settings = PlayerHelper.prepareSettings(params);
            this.player = PlayerHelper.build(settings);
            this.playerSettings = settings;
            this.playerTimeout = {};
            this.subtitles = {};
            PlayerHelper.setPlayerInstance(this);
        }catch(err){
            console.error(err);
        }
    }
    window.Player = Player;
})();