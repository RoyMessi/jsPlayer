(function(){
    const VALID_MIMETYPE = {'mp3':'audio','mp4':'video','mkv':'video'};
    const DEFAULT_MUTED = false;
    const JUMP_IN_TIME = 20;
    const JUMP_IN_VOLUME = 0.1;
    const DEFAULT_VOLUME = 0.2;

    let PlayerHelper = (function(){

        let Global = (function(){
            return {
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
                appendPlayerNotification:function(player,ev_type){
                    if(player.tagName.toLowerCase()==='audio') return false;
                    let noteContainer = player.parentElement.querySelector('.player-note-container');
                    if(!noteContainer){
                        noteContainer = document.createElement('div');
                        noteContainer.tabIndex = -1;
                        noteContainer.className = 'player-note-container';
                    }else{
                        noteContainer.innerHTML = '';
                    }

                    let note = document.createElement('div');
                    note.className = 'player-note';
                    if(['play','pause'].indexOf(ev_type)>-1){
                        note.className += ' fas fa-'+ev_type;
                    }
                    noteContainer.appendChild(note);
                    noteContainer.style.height = player.getBoundingClientRect().height+'px';

                    if(['play'].indexOf(ev_type)>-1){
                        setTimeout(function(){
                            player.focus();
                            noteContainer.remove();
                        },1000);
                    }

                    player.parentElement.appendChild(noteContainer);
                    console.log('ev_type',ev_type);
                }
            }
        })();

        let HandleButtons = (function(player,playerContainer){
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
                    playerContainer.appendChild(parent);
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
                    playerContainer.appendChild(btn);
                },
                toggleMute:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn toggle-mute fas fa-volume-' + (player.muted ? 'mute' : 'up');
                    btn.addEventListener('click',function(){
                        player.muted = !player.muted;
                        Global.setVolumeIcon(player);
                        playerContainer.querySelector('.volume').disabled = player.muted;
                    });
                    playerContainer.appendChild(btn);
                },
                JumpForward:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn fas fa-forward';
                    btn.title = 'Jump +'+JUMP_IN_TIME;
                    btn.addEventListener('click',function(){
                        player.currentTime+=JUMP_IN_TIME;
                    });
                    playerContainer.appendChild(btn);
                },
                JumpBackward:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn fas fa-backward';
                    btn.title = 'Jump -'+JUMP_IN_TIME;
                    btn.addEventListener('click',function(){
                        player.currentTime-=JUMP_IN_TIME;
                    });
                    playerContainer.appendChild(btn);
                },
                playPause:function(){
                    let btn = document.createElement('button');
                    btn.className = 'player-btn play-pause fas fa-play';
                    btn.addEventListener('click',function(){
                        player.parentElement.querySelector('.play-pause').className =
                            'player-btn play-pause fas fa-' + (player.paused ? 'pause' : 'play');
                        player.paused ? player.play() : player.pause();
                    });
                    playerContainer.appendChild(btn);
                }
            }
        });

        function HandleEvents(player,playerContainer){
            player.addEventListener('timeupdate',function(e){
                let player = e.target;
                let dur = player.duration;
                player.parentElement.querySelector('.timeline').style.width = ((player.currentTime / dur) * 100) + '%';
            });
            player.addEventListener('play',function(e){
                Global.appendPlayerNotification(player,e.type);
            });
            player.addEventListener('pause',function(e){
                Global.appendPlayerNotification(player,e.type);
            });
            player.addEventListener('ended',function(e){
                playerContainer.querySelector('.play-pause').className = 'player-btn play-pause fas fa-undo-alt';
            });
            player.addEventListener('volumechange',function(e){
                Global.setVolumeIcon(player);
                playerContainer.querySelector('.volume').disabled = player.muted;
            });

            playerContainer.addEventListener('keyup',function(e){
                let ignoreArrowEvents = e.target.classList.contains('ignore-arrow-events');
                let keyCode = e.keyCode || e.which;
                if(keyCode===37 && !ignoreArrowEvents) player.currentTime-=JUMP_IN_TIME;
                if(keyCode===39 && !ignoreArrowEvents) player.currentTime+=JUMP_IN_TIME;
                if(keyCode===38 && !ignoreArrowEvents) Global.updateVolume(player,1);
                if(keyCode===40 && !ignoreArrowEvents) Global.updateVolume(player,0);
                if(keyCode===77) player.muted=!player.muted;
                if(keyCode===32) playerContainer.querySelector('.play-pause').dispatchEvent(new Event('click'));
                // console.log('keyCode',keyCode);
            });
        }

        function PlayerControls(player,playerContainer){
            let timelineContainer = document.createElement('div');
            timelineContainer.className = 'timeline-container';
            timelineContainer.addEventListener('click',function(e){
                let rect = timelineContainer.getBoundingClientRect();
                let percent = ((e.clientX - rect.left) / rect.width) * 100;
                let segment = (player.duration / 100);
                player.currentTime = segment * percent;
            });
            let timeline = document.createElement('div');
            timeline.className = 'timeline';
            timeline.tabIndex = -1;
            timelineContainer.appendChild(timeline);

            playerContainer.appendChild(timelineContainer);

            let handleButtons = HandleButtons(player,playerContainer);
            handleButtons.playPause();
            handleButtons.JumpBackward();
            handleButtons.JumpForward();
            handleButtons.toggleMute();
            handleButtons.volume();
            handleButtons.playbackRate();
        }

        return {
            build:function(settings){
                let id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                let player = document.createElement(settings.mediaType);
                player.src = settings.src;
                player.tabIndex = -1;
                player.volume = DEFAULT_VOLUME;
                player.muted = DEFAULT_MUTED;
                player.classList.add('player-'+id);

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
                    params.mediaType = VALID_MIMETYPE[ src ];
                }
                return params;
            }
        }
    })();

    function Player(params){
        try{
            let settings = PlayerHelper.prepareSettings(params);
            this.player = PlayerHelper.build(settings);
        }catch(err){
            console.error(err);
        }
    }

    window.Player = Player;
})();