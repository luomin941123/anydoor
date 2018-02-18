const fs=require('fs');
const path=require('path');
const Handlebars=require('handlebars');
const promisify=require('util').promisify;
const stat=promisify(fs.stat);
const readdir=promisify(fs.readdir);
// const config=require('../config/defaultConfig');
const mime=require('./mime.js');
const compress=require('./compress.js');
const range=require('./range.js');
const isFresh=require('./cache.js');

const tplPath=path.join(__dirname,'../template/dir.tpl');
const source=fs.readFileSync(tplPath);//文件读出的buffer类型
const template=Handlebars.compile(source.toString());//传入的参数要是字符串

module.exports=async function(req,res,filePath,config){
  try {
    const stats=await stat(filePath);
    const contentType=mime(filePath);
    if(stats.isFile()){
      res.setHeader('Content-Type',contentType);
      //判断文件是否新鲜，是否需要使用缓存
      if(isFresh(stats,req,res)){
        res.statusCode=304;
        res.end();
        return;
      }

      let rs;
      const {code,start,end}=range(stats.size,req,res);
      if(code===200){
        res.statusCode=200;
        rs=fs.createReadStream(filePath);
      }else{
        res.statusCode=206;
        rs=fs.createReadStream(filePath,{start,end});
      }
      if(filePath.match(config.compress)){
        rs=compress(rs,req,res);
      }
      rs.pipe(res);
    }else if(stats.isDirectory()){
      const files=await readdir(filePath);
      res.statusCode=200;
      res.setHeader('Content-Type','text/html');
      const dir=path.relative(config.root,filePath);
      const data={
        title: path.basename(filePath),
        dir: dir?`/${dir}`:'',
        files
        // files:files.map(file=>{
        //   return {
        //     file,
        //     icon:mime(file)
        //   }
        // })
      };
      res.end(template(data));
    }
  } catch(ex){
    res.statusCode=404;
    res.setHeader('Content-Type','text/plain');
    res.end(`${filePath} is not a directory or a file.`);
  }
}
