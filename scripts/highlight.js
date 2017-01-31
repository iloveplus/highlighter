var office = angular.module("OfficeNote",[]).controller("OfficeCtrl",["$scope","$http","officeService",function($scope,$http,officeService) {
  var highlighter,noteTodo={},highArray=[];
  var classNames=["hc0","hc1","hc2","hc3","hc4","hc5","hc6","hc7","hc8"];
  var defaultNoteClass="hc0";
  rangy.init();

  //初始化数据
  $scope.initOfficeData=function(data){
    for(var i=0;i<data.length;i++){
      var id=data[i].ID;
      if(data[i].Flag==0){
        var highlight= highlighter.addHighlight(data[i].StartPos,data[i].EndPos,id,ReSetClassApplier(classNames[data[i].ProofreadType-1]+"_"+id),"doc-html");
        highArray.push(highlight);
      }
    }
  }

  //初始化
  function init(){
    $scope.showNote=false;
    $scope.Comments=[];
    $scope.Pages=["demo/3_1.html","demo/3_2.html","demo/3_3.html","demo/3_4.html","demo/3_5.html","demo/3_6.html","demo/3_7.html","demo/3_8.html","demo/3_9.html"];
    setTimeout(function(){
      $("#doc-html").find(".page-content").each(function(){
        var url=$(this).attr("data-html");
        $(this).load(url,function(){
            //修正图片路径
            $(this).find("img").each(function () {
                var src = $(this).attr("src");
                $(this).attr("src", "demo/"+ src);
            })
        })
      })
    },500);

    highlighter = rangy.createHighlighter();
    var classApplierModule = rangy.modules.ClassApplier;
    //初始化默认
    if (rangy.supported && classApplierModule && classApplierModule.supported) {
      for (var i = 0; i < classNames.length; i++) {
        ReSetClassApplier(classNames[i]);
      }
    }

    var data=[];
    $scope.initOfficeData(data);
  }
  init();

  //获取批注评论
  function GetComments(id,type,lastid,condition){
    officeService.getCommentInfo(id,type,lastid,condition).then(function(data){
      if(data.status){
        $scope.Comments=data.info;
        $("#doc-comment-content").niceScroll({cursorborder: "",cursorcolor:"#cdcdcd"});
      }
    },function(){

    })
  }

  //显示评论对应高亮部分
  function showCommentHighlight(id){
    //移除默认标记区域
    $('[class^="hc"].active').removeClass("active");
    //获取标记对象
    var curHighlight=highlighter.getCurHighlightById(id);
    //添加标记
    var list=curHighlight.getHighlightElements();
    for(var i=0;i<list.length;i++){
      list[i].classList.add("active");
    }
    //如果还未添加即直接返回
    if($("#highlight_"+ id)[0]==undefined){
      return;
    }
    $(".proof-item").scrollTop($("#highlight_"+ id)[0].offsetTop-40);
    $("#highlight_"+ id).addClass("active").siblings("li").removeClass("active");
  }

  //重置ClassApplier
  function ReSetClassApplier(className){
    var applier= rangy.createClassApplier(className, {
      ignoreWhiteSpace: true,
      elementProperties: {
        onclick: function(event) {
          if($scope.showNote){
            return;
          }
          event.stopPropagation();
          event.preventDefault();
          var highlight = highlighter.getHighElementForCustom(this);
          showCommentHighlight(highlight.id);
        }
      }
    });
    highlighter.addClassApplier(applier);
    return applier;
  }

  //添加批注
  $scope.AddHighlightText=function(){
    //移除默认标记区域,此步骤尤为重要
    $('[class^="hc"].active').removeClass("active");

    var t= highlighter.highlightSelection(defaultNoteClass,{containerElementId:"doc-html"});
    if(t.length==0)
      return false;

    //待批注内容
    noteTodo=highlighter.highlights[highlighter.highlights.length-1];
    noteTodo.unapply();
    noteTodo.classApplier=ReSetClassApplier(defaultNoteClass+"_NaN");

    //重置标注标识
    for(var i=0;i<highlighter.highlights.length;i++){
      highlighter.highlights[i].unapply();
    }
    highlighter.highlights=[];
    for(var i=0;i<highArray.length;i++){
      highlighter.highlights.push(highArray[i]);
      highArray[i].apply();
    }
    noteTodo.apply();
    highlighter.highlights.push(noteTodo);

    $scope.showNote=true;
    $scope.commentText="";
    if(noteTodo.getHighlightElements().length!=0){
      $("#doc-note").css("top", $(noteTodo.getHighlightElements()[0]).offset().top+$("#doc-content").scrollTop()-45);
    }
    $scope.showComment=false;
  }

  //设置颜色
  $scope.setColor=function(noteClass){
    var highlighters=highlighter.highlights;
    var id=highlighters.length==0?"":highlighters[highlighters.length-1].id;
    //移除颜色
    noteTodo.unapply();
    //移除冗余样式
    noteTodo.classApplier=ReSetClassApplier(noteClass+"_NaN");

    //重新绑定颜色
    noteTodo.apply();
    defaultNoteClass=noteClass;
  }

  //取消批注
  $scope.cancleHighLight=function(){
    var temp=highlighter.highlights;
    var index=temp.length-1;
    temp[index].unapply();
    temp.splice(index, 1);
    $scope.showNote=false;
    $scope.showComment=true;
  }

  //确认批注
  $scope.okHighLight=function(proofType){
    if($scope.commentText==""||$scope.commentText==null)  return;

    var annotation = {
      Content:$scope.commentText,
      StartPos:noteTodo.characterRange.start,
      EndPos:noteTodo.characterRange.end,
      Style:defaultNoteClass
    };

    officeService.addAnnotation(annotation).then(function(annotation){
      $scope.Comments.push(annotation);

      var len=highlighter.highlights.length-1;
      highlighter.highlights[len].id=annotation.ID;
      highlighter.highlights[len].classApplier=ReSetClassApplier(defaultNoteClass+"_"+annotation.ID);
      highlighter.highlights[len].apply();
      //清除冗余样式
      $('[class$="_NaN"]').removeClass();
      saveLastData();
      $scope.showNote=false;
      $scope.showComment=true;

      $scope.commentText = "";
    });
  }

  //删除成功后操作
  $scope.deleteAnnotationDown = function(annotation){
    //如果非全文批注，删除对应显示区域标识
    if(annotation.Flag==0){
      highlighter.removeHighlightById(annotation.ID);
      saveLastData();
    }
  }

  //保存上次数据
  function saveLastData(){
    var arr=highlighter.highlights;
    //按前后进行排序
    arr.sort(function(a,b){
      return a.characterRange.start>b.characterRange.start?1:-1
    });

    //保存上次数据
    highArray=[];
    for(var i=0;i<arr.length;i++){
      highArray.push(arr[i]);
    }

    console.log(highlighter.serialize())
  }

  //显示标记区域
  $scope.showCurHighlight=function(annotation){
    var root=$("#doc-content");

    //重置滚动条偏移位置
    root.scrollTop(0);
    var id=annotation.ID;
    //移除默认标记区域
    $('[class^="hc"].active').removeClass("active");

    //获取标记对象
    var curHighlight=highlighter.getCurHighlightById(id);
    //添加标记
    var list=curHighlight.getHighlightElements();
    for(var i=0;i<list.length;i++){
      list[i].classList.add("active");
    }
    ////如果还未添加即直接返回
    //if($("#highlight_"+ id)[0]==undefined){
    //  return;
    //}
    var offsetY=$(list[0]).offset().top -root.scrollTop() - 80;
    root.scrollTop(offsetY);

    $("#highlight_"+ id).addClass("active").siblings("li").removeClass("active");
  }
}])
.service('officeService', ['$http', '$q', function ($http, $q) {
  //添加批注
  this.addAnnotation=function(annotation){
    var deferred = $q.defer();
    annotation.ID=new Date().getTime();
    deferred.resolve(annotation);
    return deferred.promise;
  }

  //删除批注
  this.deleteHighlight=function(id){
    var deferred = $q.defer();
    $http({
      method: 'DELETE',
      url: "http://10.10.1.31:8064/api/project/proofread?id="+id
    }).success(function (data) {
      deferred.resolve(data);
    }).error(function (data) {
      deferred.reject(data);
    });
    return deferred.promise;
  }
}])
.filter("",function(){

  })
