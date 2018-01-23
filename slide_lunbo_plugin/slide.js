/**
 * Created by qiqi on 17/12/25.
 */
//AMD
(function (global, factory) {

  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
      (factory((global)));

}(this, (function (exports) {
  'use strict';

  var isInit = false;
  var mainStore = Object.create(null);
  var state = Object.create(null);

  function iceSkating(option){
    if (!(this instanceof iceSkating)) return new iceSkating(option);

    var ic = this;

    //判断是否支持transition
    if(!ic.support.transition) return;

    //拿到目标对象
    var container = document.querySelector(option.containerId);

    var id = option.containerId.substr(1),
      critical = option.critical || 0.1,
      childWidth = container.children[0].offsetWidth,  //包含border,padding,content的宽度
      childHeight = container.children[0].offsetHeight;

    //定义当前对象的store,顺便存储于全局变量中
    ic.store = mainStore[id] = {
      id: id,
      container: container,
      childLength: container.children.length,
      childWidth: childWidth,
      childHeight: childHeight,
      index: 0,
      translateX: 0,
      translateY: 0,
      touchRatio: option.touchRatio || 1,
      direction: option.direction || 'x',
      critical: critical,
      animationDuration: option.animationDuration || 300,
      fastClickTime: option.fastClickTime || 300,
      limitDisX: critical * childWidth,
      limitDisY: critical * childHeight,
      clickCallback: option.clickCallback,
      iceEndCallBack: option.iceEndCallBack,
      autoPlayID: null,
      autoPlay: option.autoPlay || false,
      autoplayDelay: option.autoplayDelay || 3000,
      preventClicks: option.preventClicks || true
    };



    //获取和初始化一些属性.
    var touchStart = function(e){
      //防止pc端的右键
      console.log(ic.support.touch,e.which)
      if (!ic.support.touch && 'which' in e && e.which === 3) return;

      //state全局只有一个
      state.startX = e.type === 'touchstart' ? e.targetTouches[0].pageX : e.pageX;  // pageX 是一个由MouseEvent接口返回的相对于整个文档的x（水平）坐标
      state.startY = e.type === 'touchstart' ? e.targetTouches[0].pageY : e.pageY;  //event.type是什么事件.

      state.startTime = e.timeStamp;         //点击持续时间还是时间戳
      state.currentTarget = e.currentTarget; //事件绑定元素
      state.id = e.currentTarget.id;
      state.target = e.target;              //事件触发元素

      state.currStore = mainStore[e.currentTarget.id];
      state.touchEnd = state.touchMove = false;
      state.touchStart = true;

      state.diffX = state.diffY = 0;
      state.animatingX = state.animatingY = 0;
    };


    //滑动多少,就能看到移动多少.
    var touchMove = function(e){

      if(e.target !== state.target || state.touchEnd || !state.touchStart) return;
      state.touchMove = true;

      var currentX = e.type === 'touchmove' ? e.targetTouches[0].pageX : e.pageX;
      var currentY = e.type === 'touchmove' ? e.targetTouches[0].pageY : e.pageY;

      var currStore = state.currStore; //系统存储的唯一state

      //点二次点击某元素才执行.
      if(currStore.animating){
        var animationTranslate = getTranslate(state.currentTarget);
        state.animatingX = animationTranslate.x - currStore.translateX;
        state.animatingY = animationTranslate.y - currStore.translateY;
        currStore.animating = false;
        removeTransitionDuration(currStore.container);
      }

      //第一次点击不执行.
      if(currStore.autoPlayID !== null){
        clearTimeout(currStore.autoPlayID);
        currStore.autoPlayID = null;
      }

      //由方向进行操作.
      if(currStore.direction === 'x'){
        state.diffX = Math.round((currentX - state.startX) * currStore.touchRatio);

        translate(currStore.container, state.animatingX + state.diffX + state.currStore.translateX, 0, 0);
      }else{
        state.diffY = Math.round((currentY - state.startY) * state.currStore.touchRatio);

        translate(currStore.container, 0, state.animatingY + state.diffY + state.currStore.translateY, 0);
      }
    };

    var touchEnd = function(e){
      //状态的作用: 目前所处的被点击不再动.轮播变动.
      state.touchEnd = true;

      if(!state.touchStart) return;


      var fastClick ;
      var currStore = state.currStore;

      //为了执行配置的click函数,显示点了谁,if作用:防止是滑动,长按.( =比&&优先级低 也比<低)
      if(fastClick = (e.timeStamp - state.startTime) < currStore.fastClickTime && !state.touchMove && typeof currStore.clickCallback === 'function'){
        currStore.clickCallback();
      }

      //防止未滑动执行
      if(!state.touchMove) return;

      //作用:点击圆圈.
      // fastClick:整个点击滑动持续时间.fastClick防止是长按
      //点后的轮播
      if(fastClick || (Math.abs(state.diffX) < currStore.limitDisX && Math.abs(state.diffY) < currStore.limitDisY)){

        if(state.diffX === 0 && state.diffY === 0 && currStore.autoPlay) autoPlay(currStore); //点击后轮播
        //移动最小距离不满足时,都移动0,currStore唯一
        recover(currStore, currStore.translateX, currStore.translateY, 0);

      }else{
        //条件满足可以移动
        //真正的移动.
        if(state.diffX > 0 || state.diffY > 0) {
          moveTo(currStore, currStore.index - 1);
        }else{
          moveTo(currStore, currStore.index + 1);
        }

      }
    };


    //需要recover
    var moveTo = function(store, index){
      var currStore = store; //唯一

      if(index < currStore.childLength && index > -1){
        setIndex(currStore, index);//记录移动到的index

        if(currStore.direction === 'x'){
          recover(currStore, -index * currStore.childWidth, 0, 0);
          currStore.translateX = -index * currStore.childWidth; //记录上一次的成功的滑动了多少.
        }else{
          recover(currStore, 0 , -index * currStore.childHeight, 0);
          currStore.translateY = -index * currStore.childHeight;
        }

      }else {
        //后面没有东西移不动
        recover(currStore, currStore.translateX , currStore.translateY, 0);
      }
    };

    var setIndex = function(store, index){
      store.index = index;
    };



    var recover = function(store, x, y, z){
      store.animating = true;
      //过渡的持续时间配置
      transitionDuration(store.container, store.animationDuration);
      //真正的移动
      translate(store.container, x, y, z);
    };

    var translate = function(ele, x, y, z){
      if (ic.support.transforms3d){
        transform(ele, 'translate3d(' + x + 'px, ' + y + 'px, ' + z + 'px)');
      } else {
        transform(ele, 'translate(' + x + 'px, ' + y + 'px)');
      }
    };

    var transform = function(ele, transform){
      var elStyle = ele.style;
      elStyle.webkitTransform = elStyle.MsTransform = elStyle.msTransform = elStyle.MozTransform = elStyle.OTransform = elStyle.transform = transform;
    };




    var transitionDuration = function(ele,time){
      var elStyle = ele.style;
      elStyle.webkitTransitionDuration = elStyle.MsTransitionDuration = elStyle.msTransitionDuration = elStyle.MozTransitionDuration = elStyle.OTransitionDuration = elStyle.transitionDuration = time + 'ms';
    };

    var removeTransitionDuration = function(ele){
      var elStyle = ele.style;
      elStyle.webkitTransitionDuration = elStyle.MsTransitionDuration = elStyle.msTransitionDuration = elStyle.MozTransitionDuration = elStyle.OTransitionDuration = elStyle.transitionDuration = '';
    };

    var transitionDurationEndFn = function(){
      ic.store.animating = false;
      //transition执行完后变动按钮颜色
      if(typeof ic.store.iceEndCallBack === 'function')  ic.store.iceEndCallBack();
      transitionDuration(container, 0);
      if(ic.store.id === state.id) state = Object.create(null);
      if(ic.store.autoPlay) autoPlay(ic.store);
    };

    var getTranslate = function(el){
      var curStyle = window.getComputedStyle(el);
      var curTransform = curStyle.transform || curStyle.webkitTransform;
      var x,y; x = y = 0;
      curTransform = curTransform.split(', ');
      if (curTransform.length === 6) {
        x = parseInt(curTransform[4], 10);
        y = parseInt(curTransform[5], 10);
      }
      return {'x': x,'y': y};
    };

    //先看moveTo.   循环
    var autoPlay = function(store){
      store.autoPlayID = setTimeout(function(){
        var index = store.index;
        ++index;
        if(index === store.childLength){
          index = 0;
        }
        moveTo(store, index);
      },store.autoplayDelay);

    };




    ic.moveToIndex = function(index){
      var currStore = ic.store;
      if(currStore.index === index) return;
      if(currStore.autoPlayID){
        clearTimeout(currStore.autoPlayID);
        currStore.autoPlayID = null;
      }
      moveTo(currStore, index);
    };

    ic.getIndex = function(){
      return ic.store.index;
    };

    ic.preventClicks = function(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    var initEvent = function(){
      var events = ic.support.touch ? ['touchstart', 'touchmove', 'touchend']:['mousedown','mousemove','mouseup'];

      var transitionEndEvents = ['webkitTransitionEnd', 'transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'msTransitionEnd'];

      //监听transitionend,变化按钮颜色.
      for (var i = 0; i < transitionEndEvents.length; i++) {
        ic.addEvent(container, transitionEndEvents[i], transitionDurationEndFn, false);
      }

      //监听点击事件
      ic.addEvent(container, events[0], touchStart, false);

      //如果配置了阻止点击就生效
      if(ic.store.preventClicks) ic.addEvent(container, 'click', ic.preventClicks, false);


      //冒泡后在document可以检测到,但是touchStart用doucment就不行.
      if(!isInit){
        ic.addEvent(document, events[1], touchMove, false);
        ic.addEvent(document, events[2], touchEnd, false);
        isInit = true;
      }
    };

    initEvent();
    //自动播放
    if(ic.store.autoPlay) autoPlay(ic.store);
  }



  iceSkating.prototype = {
    addEvent: function(target, type, fn, capture){
      target.addEventListener(type, fn, capture);
    },
    support: {
      touch: (function(){
        return !!(('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch);
      })(),
      transforms3d : (function () {
        var div = document.createElement('div').style;
        return ('webkitPerspective' in div || 'MozPerspective' in div || 'OPerspective' in div || 'MsPerspective' in div || 'perspective' in div);
      })(),
      transition : (function () {
        var div = document.createElement('div').style;
        return ('webkitTransition' in div || 'MozTransition' in div || 'OTransition' in div || 'MsTransition' in div || 'transition' in div);
      })()
    }
  };

  //导出构造器
  exports.iceSkating = iceSkating;

})));
