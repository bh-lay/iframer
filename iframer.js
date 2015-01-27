/**
 * @author bh-lay
 * @github https://github.com/bh-lay/iframer/
 * @modified 2015-1-28 00:03
 */
(function(window,document,iframer_factory,utils_factory){
	var utils = utils_factory(window,document);
    window.iframer = window.iframer || iframer_factory(window,document,utils);
})(window,document,function(window,document,utils){
    var private_activeIframe,
		//记录组件是否已被初始化
        private_isInited = false,
		//主页面域名（包含协议）
		private_page_domain,
		//单页主页面路径
		private_basePage_path,
		//获取url中域名（包含协议）正则
		private_reg_domain = /^(?:\w+\:)*\/\/[^\/]*/,
		//由于hash的特殊性，在这里记录是否刷新iframe视图
		private_needRefresh = true,
        //修改title事件
        private_beforeTitleChange,
		private_iframeOnload,
		LOCATION = window.location;
	//获取最新的hash
	function getHash(hashStr){
		return (hashStr || LOCATION.hash || '#!').replace(/^#!/,'')
	}
	var onhashchange = (function(){
		var hashchange = 'hashchange',
			documentMode = document.documentMode,
			supportHashChange = ('on' + hashchange in window) && ( documentMode === void 0 || documentMode > 7 );
		if(supportHashChange){
			return function(callback){
				window.onhashchange = function(e){
					callback && callback(getHash());
				};
				callback && callback(getHash());
			}
		}else{
			return function (callback){
				//记录hash值
				var private_oldHash = LOCATION.hash;
				setInterval(function(){
					var new_hash = LOCATION.hash || '#';
					//hash发生变化
					if(new_hash != private_oldHash){
						private_oldHash = new_hash;
						callback && callback(getHash(new_hash));
					}
				},50);
				callback && callback(getHash());
			}
		}
	})();
	//修改hash
	function changeHash(url,win){
		win = win || window;
		url = hrefToAbsolute(url,win.location.pathname);
		if(url.length < 1){
			return
		}
		LOCATION.hash = '!' + decodeURIComponent(url);
	}
    //IFRAMER 主对象
    var IFRAMER = {
        default_url : '/',
        expect_class : null,
        init : function (param){
            if(private_isInited){
                console && console.error &&  console.error('iframer should be initialized only once');
            }else{
                var param = param || {};
                if(!param.container){
                    console && console.error &&  console.error('missing arguement "container"');
                }else if(!utils.isDOM(param.container)){
                    console && console.error &&  console.error('arguement "container" must be a dom');
                }else{
                    INIT.call(this,param);
                }
            }
        },
        //承载iframe的dom
        container : null,
         //修改主页面title
        updateTitle: function (title){
            if(private_beforeTitleChange){
                var newTitle = private_beforeTitleChange(title);
                title = newTitle ? newTitle : title;
            }
            document.title = title;
        },
        /**
         * 修改页面hash锚点
         *  win为调用者所在的 windows
         */
        jumpTo : changeHash
    };
	//初始化
	function INIT(param){
		this.container = param.container;
		this.expect_class = utils.TypeOf(param.expect_class) == 'string' ? param.expect_class : 'spa-expect-links';
		this.default_url = utils.TypeOf(param.default_url) == 'string' ? hrefToAbsolute(param.default_url,LOCATION.pathname) : '/';
		
		private_iframeOnload = utils.TypeOf(param.iframeOnload) == "function" ? param.iframeOnload : null;
		private_beforeTitleChange = utils.TypeOf(param.beforeTitleChange) == "function" ? param.beforeTitleChange : null;
		private_basePage_path = LOCATION.pathname;
		private_page_domain = LOCATION.protocol + '//' + LOCATION.host;
		
		var firstHash = (LOCATION.hash || '#!').replace(/^#\!/,'');

		LOCATION.hash = '!' + (firstHash.length ? hrefToAbsolute(firstHash,LOCATION.pathname) : this.default_url);
		setTimeout(function(){
			//监听hashchange事件
			onhashchange(function(url){
				if(!private_needRefresh){
					private_needRefresh = true;
					return;
				}
				url = url || IFRAMER.default_url;
				if(url == private_basePage_path){
					url = IFRAMER.default_url;
					changeHash(url);
				}else{
					createNewPage(url);
				}
			});
		});

		private_isInited = true;
	}
	
	/**
	 * 转换各类地址至相对站点根目录地址
	 *	如  'http://xxx.xx/blog/cssSkill.html','https://xxx.xx/blog/cssSkill.html',
	 *		'//xxx.xx/blog/cssSkill.html'
	 *		'../../blog/cssSkill.html',
	 *		'blog/cssSkill.html'
	 **/
	function hrefToAbsolute(src,base_path){
		/**
		 * 截断域名
		 *	http://
		 *	https://
		 *	//
		 */
		src = src.replace(private_reg_domain,'');

		//符合要求，直接返回src: /blog/cssSkill.html
		if(src.charAt(0) == "/"){
			return src;
		}
		
		base_path = /^[^?#]*\//.exec(base_path)[0];
		//src: '../../blog/cssSkill.html'
		if(src.match(/^\.\.\//)){
			src = src.replace(/\.\.\//g,function(){
				//每匹配到一个“../”，base_path向前退一位
				base_path = base_path.replace(/\/[^\/]*\/$/,'/');
				return '';
			});
		}
		return base_path + src; 
	}
	//创建新的页面
	function createNewPage(url){
        var oldIframe = private_activeIframe;
		var iframe = document.createElement('iframe'); 
		var elem_loading = utils.createDom('<div style=position:absolute;top:0;left:0;width:100%;height:100%;opacity:.5></div>')[0];
		iframe.src= url;
		iframe.frameBorder = 0;
		
        IFRAMER.container.appendChild(iframe);
        IFRAMER.container.appendChild(elem_loading);
		if(oldIframe){
			utils.css(iframe,{
				height: 0
			});
		}
		//监听iframe load事件
        utils.bind(iframe,'load',function(){
			oldIframe && utils.removeNode(oldIframe);
			utils.removeNode(elem_loading);
			utils.css(iframe,{
				height: ''
			});
			//
			try{
				//子window对象
				var iWindow = iframe.contentWindow,
					iDoc = iframe.contentWindow.document;
				//主动触发iframe加载回调
				private_iframeOnload && private_iframeOnload.call(iDoc,iWindow,iDoc);

				//监听事件
				bindEventsForIframe(iWindow,iDoc);
			}catch(e){}
		});
		
        //更新当前iframe标记
		private_activeIframe = iframe;
	}
	/**
	 * 检测链接是否应该忽略
	 **/
	function hrefIgnoreForSPA(href){
		var domain = href.match(private_reg_domain),
			returns = false;
		//无路径，不处理
		if(href.length == 0){
			returns = true;
		}
		//链接提供给JS使用，或锚点
		if(href.match(/^(javascript\s*\:|#)/)){
			returns = true;
		}
		//不同域名
		if(domain && domain[0] != private_page_domain){
			returns = true;
		}
		return returns;
	}
	/**
	 * 链接包含配置排除class
	 **/
	function linkExpect(link){
		if(utils.hasClass(link,IFRAMER.expect_class)){
			return true;
		}
	}
    //绑定iframe事件
    function bindEventsForIframe(iWindow,iDoc){
		//应对服务器可能重定向,或内部跳转
		if(iWindow.location.pathname != getHash()){
			//若重定向到了最外层地址
			if(iWindow.location.pathname == private_basePage_path){
				//跳转至默认页
				changeHash(IFRAMER.default_url);
			}else{
				//静默修改地址
				private_needRefresh = false;
				changeHash(iWindow.location.href,iWindow);
			}
		}

		//更新网页标题
		IFRAMER.updateTitle(iWindow.document.title);
		//处理非单页链接跳转问题
		utils.bind(iWindow.document,'mousedown','a',function(evt){
			var href = this.getAttribute('href') || '',
				target = this.getAttribute('target');
			//定义排除class，加上_blank,没有taget并且href不应该被忽略
			if(linkExpect(this) || (!target && !hrefIgnoreForSPA(href))){
				this.setAttribute('target','_blank');
			}
			//若链接指向了最外层地址，更改为默认地址
			if(href == private_basePage_path){
				this.setAttribute('href',IFRAMER.default_url);
			}
		});
		//监听iframe内 单页按钮点击事件
		utils.bind(iWindow.document,'click','a' ,function(evt){
			var href = this.getAttribute('href') || '';
			if(hrefIgnoreForSPA(href) || linkExpect(this)){
				return;
			}

			IFRAMER.jumpTo(href,iWindow);
			//阻止浏览器默认事件
			var evt = evt || iWindow.event; 
			if (evt.preventDefault) {
				evt.preventDefault(); 
			} else { 
				evt.returnValue = false; 
			}
		});
    }
    
    return IFRAMER;
},function (window,document) {
	/**
	 * 判断对象类型
	 * string number array
	 * object function 
	 * htmldocument
	 * undefined null
	 */
	function TypeOf(obj) {
		return Object.prototype.toString.call(obj).match(/\s(\w+)/)[1].toLowerCase();
	}
	
	/**
	 * 检测是否为数字
	 * 兼容字符类数字 '23'
	 */
	function isNum(ipt){
		return (ipt !== '') && (ipt == +ipt) ? true : false;
	}
	
	/**
 	 * 遍历数组或对象
	 * 
	 */
	function each(arr,fn){
		//检测输入的值
		if(typeof(arr) != 'object' || typeof(fn) != 'function'){
			return;
		}
		var Length = arr.length;
		if( isNum(Length) ){
			for(var i=0;i<Length;i++){
				if(fn.call(this,i,arr[i]) === false){
					break
				}
			}
		}else{
			for(var i in arr){
				if (!arr.hasOwnProperty(i)){
					continue;
				}
				if(fn.call(this,i,arr[i]) === false){
					break
				}
			}
		}
	}
	
	/**
	 * 对象拷贝
	 *
	 */
	function clone(fromObj,toObj){
		each(fromObj,function(i,item){
			if(typeof item == "object"){   
				toObj[i] = item.constructor==Array ? [] : {};
				
				clone(item,toObj[i]);
			}else{
				toObj[i] = item;
			}
		});
		
		return toObj;
	}	
	/**
	 * 判断是否支持css属性
	 * 兼容css3
	 */
	var supports = (function() {
		var styles = document.createElement('div').style,
			vendors = 'Webkit Khtml Ms O Moz'.split(/\s/);
		
		return function(prop) {
			var returns = false;
			if ( prop in styles ){
				returns = prop;
			}else{
				prop = prop.replace(/^[a-z]/, function(val) {
					return val.toUpperCase();
				});
				each(vendors,function(i,value){
					if ( value + prop in styles ) {
						returns = ('-' + value + '-' + prop).toLowerCase();
					}
				});
			}
			return returns;
		};
	})();
	
	
	var private_css3 = (supports('transition') && supports('transform')) ? true : false;
	
	/**
	 * 判断dom是否拥有某个class
	 */
	function hasClass(dom,classSingle){
		return dom.className && dom.className.match(new RegExp('(\\s|^)' + classSingle + '(\\s|$)')) || false;
	}
	
	//获取样式
	function getStyle(elem, prop) {
		var value;
		prop == "borderWidth" ? prop = "borderLeftWidth" : prop;
		if (elem.style[prop]){
			value = elem.style[prop];
		} else if(document.defaultView) {
			var style = document.defaultView.getComputedStyle(elem, null);
			value = prop in style ? style[prop] : style.getPropertyValue(prop);
		} else if (elem.currentStyle) {
			value = elem.currentStyle[prop];
		}
		
		
		if (/\px$/.test(value)){
			value = parseInt(value);
		}else if (isNum(value) ){
			value = Number(value);
		} else if(value == '' || value == 'medium'){
			value = 0;
		} else if (value == 'auto'){
			if(prop == 'height'){
				value = elem.clientHeight;
			}else if(prop == 'width'){
				value = elem.clientWidth;
			}
		}
		
		return value;
	}
	

	/**
	 * dom设置样式
	 */
	function setStyle(elem,prop,value){
		prop = prop.toString();
		if (prop == "opacity") {
			elem.style.filter = 'alpha(opacity=' + (value * 100)+ ')';
			value = value;
		} else if ( isNum(value) && prop != 'zIndex'){
			value = value + "px";
		}
		elem.style[prop] = value;
	}
	//设置css
	function setCss(doms,cssObj){
		doms = [].concat(doms);
		
		/**
		 * 为css3属性增加扩展
		 */
		each(cssObj,function(key,value){
			if(key == 'transform' || key == 'transition'){
				each(['webkit','o','moz'],function(i,text){
					cssObj['-' + text + '-' + key] = value
				});
			}
		});
		each(doms,function(i,dom){
			each(cssObj,function(key,value){
				setStyle(dom,key,value);
			});
		});
	}
	
	/**
	 * css3动画
	 * 内部类，不检测参数
	 */
	function css3_anim(elem,cssObj,durtime,animType,onEnd){
		//记录初始transition值
		var transition_start = getStyle(elem,'transition');
		var cssSet = clone(cssObj,{
			'transition' : durtime + 'ms ' + animType
		});
		
		//开启3d加速
		if(!cssSet.transform){
			cssSet.transform = 'translate3d(0, 0, 0)';
		}else if(!cssSet.transform.match('translate3d')){
			cssSet.transform = cssSet.transform + ' translate3d(0, 0, 0)';
		}
		/**
		 * 动画结束回调
		 */
		function endFn(){
			endFn = null;
			elem.removeEventListener("webkitTransitionEnd",transitionFn, true);
			//还原transition值
			setCss(elem,{
				'transition' : transition_start || 'all 0s'
			});
			onEnd && onEnd.call(elem);
		}
		
		/**
		 * 高大上的webkitTransitionEnd
		 *   动画过程中，在每一帧持续触发
		 */
		var delay;
		function transitionFn(){
			clearTimeout(delay);
			delay = setTimeout(function(){
				endFn && endFn();
			},40);
		}
		elem.addEventListener("webkitTransitionEnd",transitionFn, true);
		
		/**
		 * 加一份保险
		 *   解决 css无变化时webkitTransitionEnd事件不会被触发的问题
		 */
		setTimeout(function(){
			endFn && endFn();
		},durtime + 80);
		
		/**
		 * 不知道为啥，若刚设置完css再修改同一属性，firefox下没效果
		 *   可能是浏览器优化css动画的逻辑
		 *	 故加定时器解决此bug
		 */
		setTimeout(function(){
			setCss(elem,cssSet);
		},10);
	}
	/**
	 * css3动画
	 * @param elem dom对象
	 * @param cssObj 动画对象
	 * @param durtime 持续时间
	 * @param [animType] 缓动类型
	 * @param [callback] 回调
	 */
	function animation(elem,cssObj,durtime,a,b) {
        var animType = "linear",
			onEnd = null;
		
		if (arguments.length < 3) {
			throw new Error("missing arguments [dom,cssObj,durtime]");
		} else {
			if (TypeOf(a) == "function") {
				onEnd = a;
			}else if (typeof (a) == "string") {
				animType = a;
			}
			
			if (TypeOf(b) == "function") {
				onEnd = b;
			}
		}
		if(private_css3){
			return css3_anim(elem,cssObj,durtime,animType,onEnd);
		}else{
			setCss(elem,cssObj);
			onEnd && onEnd.call(elem);
		}
	}
	
	/**
	 * 事件绑定
	 * elem:节点
	 * type:事件类型
	 * handler:回调
	 */
    var bindHandler = (function() {
		// 标准浏览器
		if (window.addEventListener) {
			return function(elem, type, handler) {
				elem.addEventListener(type, handler, false);
			}
		} else if (window.attachEvent) {
			// IE浏览器
			return function(elem, type, handler) {
				elem.attachEvent("on" + type, handler);
			}
		}
	})();

	/**
	 * 事件解除
	 * elem:节点
	 * type:事件类型
	 * handler:回调
	 */
	var removeHandler = (function() {
		// 标准浏览器
		if (window.removeEventListener) {
			return function(elem, type, handler) {
				elem.removeEventListener(type, handler, false);
			}
		} else if (window.detachEvent) {
			// IE浏览器
			return function(elem, type, handler) {
				elem.detachEvent("on" + type, handler);
			}
		}
	})();
	
	function checkEventForClass(event,classStr,dom){
		var target = event.srcElement || event.target;
		while (1) {
			if(target == dom || !target){
				return false;
			}
			if(hasClass(target,classStr)){
				return target;
			}
			
			target = target.parentNode;
		}
	}
	function checkEventForTagname(event,tagName,dom){
		var target = event.srcElement || event.target;
		while (1) {
			if(target == dom || !target){
				return false;
			}
			if(target.tagName.toLocaleLowerCase() == tagName){
				return target;
			}
			
			target = target.parentNode;
		}
	}
	function bind(elem, type,a,b){
		var className,tagName,fn;
		if(typeof(a) == 'string'){
			fn = b;
			if(a.charAt(0) == '.'){
				className = a.replace(/^\./,'');
				callback = function(e){
					var bingoDom = checkEventForClass(e,className,elem);
					if(bingoDom){
						fn && fn.call(bingoDom,e);
					}
				};
			}else{
				tagName = a;
				callback = function(e){
					var bingoDom = checkEventForTagname(e,tagName,elem);
					if(bingoDom){
						fn && fn.call(bingoDom,e);
					}
				};
			}
		}else{
			callback = a;
		}
		bindHandler(elem,type,callback);
	}
	
    return {
		TypeOf : TypeOf,
		isNum : isNum,
		each : each,
		getStyle : getStyle,
		css : setCss,
		animation : animation,
		supports : supports,
		bind : bind,
		clone : clone,
		unbind : removeHandler,
		hasClass : hasClass,
		'addClass' : function (dom, cls) {
			if (!this.hasClass(dom, cls)) dom.className += " " + cls;
		},
		'removeClass' : function (dom, cls) {
			if (hasClass(dom, cls)) {
				var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
				dom.className = dom.className.replace(reg, ' ');
			}
		},
        isDOM : ( typeof HTMLElement === 'object' ) ? function(obj){
            return obj instanceof HTMLElement;
        } : function(obj){
            return obj && typeof obj === 'object' && obj.nodeType === 1 && typeof obj.nodeName === 'string';
        },
		/**
		 * 页面加载
		 */
		ready : (function(){
			var readyFns = [];
			function completed() {
				removeHandler(document,"DOMContentLoaded", completed);
				removeHandler(window,"load", completed);
				each(readyFns,function(i,fn){
					fn();
				});
				readyFns = null;
			}
			return function (callback){
				if ( document.readyState === "complete" ) {
					callback && callback();
				} else {
					callback && readyFns.push(callback);
					
					bindHandler(document,'DOMContentLoaded',completed);
					bindHandler(window,'load',completed);
				}
			}
		})(),
		//创建dom
		createDom : function (html){
			var a = document.createElement('div');
			a.innerHTML = html;
			return a.childNodes;
		},
		//在指定DOM后插入新DOM
		insertAfter : function (newElement, targetElement){
			var parent = targetElement.parentNode;
			if (parent.lastChild == targetElement) {
				//如果最后的节点是目标元素，则直接追加
				parent.appendChild(newElement);
			} else {
				//插入到目标元素的下一个兄弟节点之前
				parent.insertBefore(newElement, targetElement.nextSibling);
			}
		},
		//移除dom节点
		removeNode : function (elem){  
			if(elem && elem.parentNode && elem.tagName != 'BODY'){  
				elem.parentNode.removeChild(elem);  
			}  
		},
		//根据class查找元素
		findByClassName : (function(){
			if(typeof(document.getElementsByClassName) !== 'undefined'){
				//支持gEbCN
				return function (dom,classStr){
					return dom.getElementsByClassName(classStr);
				};
			}else{
				//无奈采用遍历法
				return function (dom,classStr){
					var returns = [];
					//尝试获取所有元素
					var caches = dom.getElementsByTagName("*");
					//遍历结果
					each(caches,function(i,thisDom){
						//检查class是否合法
						if(hasClass(thisDom,classStr)){
							returns.push(thisDom);
						}
					});
					return returns;
				};
			}
		})(),
		//淡入
		fadeIn : function (DOM,time,fn){
			var op = getStyle(DOM,'opacity');
			setCss(DOM,{
				'opacity' : 0,
				'display' : 'block'
			});
			animation(DOM,{
				'opacity' : op
			}, time, function(){
				fn && fn.call(DOM);
			});
		},
		//淡出
		fadeOut : function (DOM,time,fn){
			var op = getStyle(DOM,'opacity');
			animation(DOM,{
				'opacity' : 0
			}, time,function(){
				DOM.style.opacity = op;
				DOM.style.display = 'none';
				fn && fn.call(DOM);
			});
		}
	};
});