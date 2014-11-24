//-------------------定数--------------------------
//インペイントの種類
var CV_INPAINT = {
NS: 0,
TELEA: 1
}


//------------------メソッド------------------------

//逆行列の演算
//入力
//mat CvMat型 逆行列を求める行列
//cvTermCriteria CvCriteria型　計算精度
//method CV_INV配列 アルゴリズムの種類
//出力
//CvMat型　求まった行列が代入される行列
function cvmInverse(mat, cvTermCriteria,  method){
    var invMat = null;
    try{
        //バリデーション
        if(cvUndefinedOrNull(mat))
            throw "mat" + ERROR.IS_UNDEFINED_OR_NULL;
        
        //初期化
        if(cvUndefinedOrNull(method)){
            if(mat.rows == mat.cols) method = CV_INV.LU;
            else method = CV_INV.SVD;
        }
        
        if(method == CV_INV.LU){
            //逆行列の存在確認
            var det = cvmDet(mat);
            if(Math.abs(det) < cvTermCriteria.eps){
                throw "cvmInverse : 逆行列は存在しません";
            }
        }
        
        if(method == CV_INV.SVD_SYM)
            throw "CV_INV.SVD_SYM は現在サポートされていません";
        
        invMat = cvCreateMat(mat.rows, mat.cols);
        
        switch(method){
            case CV_INV.LU:
                if(mat.cols != mat.rows)
                    throw "CV_INV.LUの場合、mat" + ERROR.PLEASE_SQUARE_MAT;
                
                //前進代入
                function Lforwardsubs(L, b, y){
                    for(var i = 0 ; i < L.rows ; i++)
                        y.vals[i * y.cols] = b.vals[i * b.cols];
                    
                    for(var i = 0 ; i < L.rows ; i++){
                        y.vals[i * y.cols] /= L.vals[i + i * L.cols];
                        for(var j = i + 1 ; j < L.cols ; j++){
                            y.vals[j * y.cols] -= y.vals[i * y.cols] * L.vals[ i + j * L.cols];
                        }
                    }
                }
                //後退代入
                function Ubackwardsubs(U, y, x){
                    for(var i = 0 ; i < U.rows; i++)
                        x.vals[i * x.cols] = y.vals[i * y.cols];
                    
                    for(var i = U.rows-1 ; i >= 0; i--){
                        x.vals[i * x.cols] /= U.vals[i + i * U.cols];
                        for(var j = i-1 ; j >= 0 ; j--){
                            x.vals[j * x.cols] -= x.vals[i * x.cols] * U.vals[i + j * U.cols];
                        }
                    }
                }
                
                // -- matのLU分解 --
                var LU = cvmLU(mat, L, U);
                var L = LU[0];
                var U = LU[1];
                
                for(var i = 0 ; i < mat.cols ; i++)
                {
                    var initVec = cvCreateMat(mat.rows, 1);
                    for(var v = 0 ;  v < mat.rows ; v++)
                        initVec.vals[v] = (v == i) ? 1 : 0 ;
                    
                    var dmyVec = cvCreateMat(mat.rows, 1);
                    var inverseVec = cvCreateMat(mat.rows, 1);
                    
                    Lforwardsubs(L, initVec, dmyVec);
                    Ubackwardsubs(U, dmyVec, inverseVec);
                    
                    for(var v = 0 ; v < mat.rows ; v++){
                        invMat.vals[i + v * invMat.cols] = inverseVec.vals[v * inverseVec.cols];
                    }
                }
                
                break;
            case CV_INV.SVD:
                //デフォルト
                if(cvUndefinedOrNull(cvTermCriteria))
                    cvTermCriteria = new CvTermCriteria();
                
                var mat2 = null;
                //0で補完する
                if(mat.rows < mat.cols){
                    mat2 = cvCreateMat(mat.cols, mat.cols);
                    
                    for(var i = 0 ; i < mat2.rows ; i++){
                        if(i >= mat.rows){
                            for(var j = 0; j < mat2.cols ; j++){
                                mat2.vals[j + i * mat2.cols] = 0;
                            }
                        }
                        else{
                            for(var j = 0; j < mat2.cols ; j++){
                                mat2.vals[j + i * mat2.cols] = mat.vals[j + i * mat.cols];
                            }
                        }
                    }
                }
                else{
                    mat2 = cvmCopy(mat);
                }
                
                var svd = cvmSVD(mat2, cvTermCriteria);
                var W = svd[0];
                var L = svd[1];
                var R = svd[2];
                
                //                cvDWriteMatrix(W, "W");
                
                //                var ai = cvmMul(cvmMul(L, W), R);
                //
                //                cvDWriteMatrix(ai, "元に戻る");
                
                var WW = cvCreateMat(W.rows, W.cols);
                //初期化
                for(var i = 0 ; i < WW.cols * WW.rows ; WW.vals[i++] = 0);
                
                var length = W.rows < W.cols ? W.rows : W.cols;
                for(var i = 0 ; i < length ; i++){
                    WW.vals[i + i * WW.cols] = 1.0/W.vals[i + i * W.cols];
                }
                
                //                cvDWriteMatrix(WW, "ww");
                
                var trL = cvmTranspose(L);
                
                invMat = cvmMul(cvmMul(R, WW), trL);
                //
                //                cvDWriteMatrix(invMat, "invMat");
                //
                //                cvDWriteMatrix(cvmMul(invMat, mat2), "i");
                
                break;
            case CV_INV.SVD_SYM: break;
        }
    }
    catch(ex){
        alert("cvmInverse : " + ex);
    }
    
    return invMat;
}

//特異値分解の演算
//入力
//A CvMat型 特異値分解される行列(M*N)
//cvTermCriteria CvTermCriteria型 計算精度
//flags CV_SVD型 svdの種類 CV_SVD.ZEROのみサポート　デフォルト = CV_SVD.ZERO
//出力
//[W, L, R]
//W CvMat型 特異値行列の非負の行列(M*NまたはN*N)
//L CvMat型 左直交行列(M*MまたはM*N)
//R CvMat型 右直交行列(N*N)
function cvmSVD(A, cvTermCriteria, flags){
    
    var rtn = null;
    try{
        //バリデーション
        if(cvUndefinedOrNull(A))
            throw "第一引数" + ERROR.IS_UNDEFINED_OR_NULL;
        
        //デフォルト
        if(cvUndefinedOrNull(cvTermCriteria))
            cvTermCriteria = new CvTermCriteria();
        
        if(cvUndefinedOrNull(flags)) flags = CV_SVD.ZERO;
        
        switch(flags){
            case CV_SVD.ZERO:
            {
                var trA = cvmTranspose(A);
                /*
                 //左特異ベクトル
                 var AtrA = cvmMul(A, trA);
                 AtrA = cvmMul(AtrA, AtrA);
                 var left = cvmEigen(AtrA, cvTermCriteria);
                 L = left[1];
                 
                 //右特異ベクトル
                 var trAA = cvmMul(trA, A);
                 trAA = cvmMul(trAA, trAA);
                 var right = cvmEigen(trAA, cvTermCriteria);
                 R = right[1];
                 
                 //閾値以下の固有値の個数
                 var r = 0;
                 for(var i = 0 ; i < left[0].rows ; i++){
                 if(left[0].vals[i] < cvTermCriteria.eps)
                 break;
                 r++;
                 }
                 
                 cvDWriteMatrix(left[0], "left0");
                 cvDWriteMatrix(right[0], "right0");
                 //特異値
                 var W = cvCreateMat(A.rows, A.cols);
                 for(var i = 0 ; i < W.rows * W.cols ; W.vals[i++]=0);
                 for(var i = 0 ; i < r; i++)
                 W.vals[i + i * W.cols] = Math.sqrt(Math.sqrt(left[0].vals[i]));
                 */
                var trAA = cvmMul(trA,A);
                
                var ee = cvmEigen(trAA, cvTermCriteria);
                
                //ee[1]を正規化したものがR(右特異ベクトル)
                var R = cvmCopy(ee[1]);
                for(var j = 0 ; j < R.cols ; j++){
                    var norm = 0;
                    for(var i = 0 ; i < R.rows ; i++){
                        norm += R.vals[j + i * R.cols] *  R.vals[j + i * R.cols];
                    }
                    norm = Math.sqrt(norm);
                    
                    for(var i = 0 ; i < R.rows ; i++){
                        R.vals[j + i * R.cols] /= norm;
                    }
                }
                
                //閾値以下の固有値の個数
                var r = 0;
                for(var i = 0 ; i < ee[0].rows ; i++){
                    if(ee[0].vals[i] < cvTermCriteria.eps)
                        break;
                    r++;
                }
                r = Math.min(A.cols, Math.min(A.rows, r));
                
                //固有値の個数分だけRからベクトルを抜き出す
                var R1 = cvCreateMat(trAA.rows, r);
                for(var j = 0 ; j < R1.cols ; j++){
                    for(var i = 0 ; i < R1.rows ; i++){
                        R1.vals[j + i * R1.cols] = ee[1].vals[j + i * ee[1].cols];
                    }
                }
                
                //固有値ベクトルの二乗根
                var d = cvCreateMat(r, r);
                for(var i = 0 ; i < r * r ; d.vals[i++]=0);
                for(var i = 0 ; i < r ; i++)
                    d.vals[i + i * d.cols] = Math.sqrt(ee[0].vals[i]);
                
                //特異値
                var W = cvCreateMat(A.rows, A.cols);
                for(var i = 0 ; i < W.rows * W.cols ; W.vals[i++]=0);
                for(var i = 0 ; i < d.rows; i++)
                    W.vals[i + i * W.cols] = d.vals[i + i * d.cols];
                
                
                //固有値ベクトルの二乗根の逆数
                var invD = cvCreateMat(r, r);
                for(var i = 0 ; i < r * r ; invD.vals[i++]=0);
                for(var i = 0 ; i < r ; i++)
                    invD.vals[i + i * invD.cols] = 1.0/d.vals[i + i * d.cols];
                
                //                cvDWriteMatrix(trAA, "trAA");
                //                cvDWriteMatrix(ee[0], "evecs");
                //                cvDWriteMatrix(R, "R");
                //                cvDWriteMatrix(R1, "R1");
                //                cvDWriteMatrix(invD, "invD");
                
                //
                var L1 = cvmMul(cvmMul(A, R1), invD);
                
                //                cvDWriteMatrix(L1, "L1");
                
                var L = null;
                if(L1.rows < L1.cols){
                    //[todo]
                    //ユニタリー行列となるようにする
                    L = cvCreateMat(A.rows, A.rows);
                    for(var i = 0 ; i < L1.rows ; i++){
                        for(var j = 0 ; j < L1.cols ; j++){
                            L.vals[j + i * L.cols] = L1.vals[j + i * L1.cols];
                            L.vals[L.cols / 2 + j + i * L.cols] = L1.vals[j + i * L1.cols];
                        }
                    }
                }
                else{
                    L = L1;
                }
                
                rtn = [W, L, R];
            }
                break;
                
            default:
                throw "flagsはCV_SVD.ZEROしか現在サポートされていません";
                break;
        }
    }
    catch(ex){
        alert("cvmSVD : " + ex);
    }
    
    return rtn;
}






//対称行列の固有値及び固有ベクトルを求める
//入力
//mat CvMat型 固有値と固有ベクトルを求める対称行列
//cvTermCriteria CvTermCriteria型 対角化の精度
//出力
//[eValues, eVects]
//eValues CvMat型 固有値が大きい順に並ぶ1列(行)の行列(つまりベクトル)
//eVects CvMat型 固有ベクトルを縦ベクトルにして並べる
function cvmEigen(mat, cvTermCriteria){
    var rtn = null;
    try{
        //バリデーション
        if(cvUndefinedOrNull(mat))
            throw "mat" + ERROR.IS_UNDEFINED_OR_NULL;
        if(mat.rows != mat.cols || mat.rows == 0 || mat.cols == 0)
            throw "mat" + ERROR.PLEASE_SQUARE_MAT;
        
        //対称化のチェック
        for(var i = 0 ; i < mat.rows ; i++){
            for(var j = i + 1 ; j < mat.cols ; j++){
                if(mat.vals[j + i * mat.cols] != mat.vals[i + j *mat.cols]){
                    throw "matは対称行列ではありません";
                }
            }
        }
        
        //精度の値を確認
        if(cvUndefinedOrNull(cvTermCriteria))
            cvTermCriteria = new CvTermCriteria();
        
        //オリジナルの配列をコピー
        var rq = cvmCopy(mat);
        

        //固有値の組を対角成分にもつ行列
        var R = null;
        //固有ベクトルの組(行列として結果は求まる)
        var eVects = cvCreateIdentityMat(mat.rows, mat.rows);
        
        //---QR法によるRの対角化？三角化？---
        var isOK = true;
        for(var loop = 0 ; loop < cvTermCriteria.max_iter ; loop++){
            
            var qr = cvmQR(rq);
            if(qr == null) return rtn;
            
            //Qの閾値以下を0にする
            for(var i = 0 ; i < qr[1].rows ; i++){
                for(var j = 0 ; j < qr[1].cols ; j++){
                    if(qr[1].vals[j + i * qr[1].cols] < cvTermCriteria.eps){
                        qr[1].vals[j + i * qr[1].cols] = 0;
                    }
                }
            }
            
            eVects = cvmMul(eVects, qr[0]);
            
            R = qr[1];
//            //精度のチェック(Rが対角行列か)
//            isOK = true;
//            for(var i = 0 ; i < R.rows; i++){
//                for(var j = 0 ; j < R.cols; j++){
//                    if(i != j && Math.abs(R.vals[j + i * rq.cols]) > cvTermCriteria.eps){
//                        isOK = false;
//                        break;
//                    }
//                }
//                //精度のチェックでひっかかっているならループをぬける
//                if(!isOK) break;
//            }
            
            //精度のチェック(Rが上三角行列か)
            isOK = true;
            for(var j = 0 ; j < R.cols - 1 ; j++){
                for(var i = j + 1 ; i < R.rows ; i++){
                    if(Math.abs(R.vals[j + i * R.cols]) > cvTermCriteria.eps){
                        isOK = false;
                        break;
                    }
                }
                //精度のチェックでひっかかっているならループをぬける
                if(!isOK) break;
            }
            
            //精度が問題なければfor文を抜ける
            if(isOK) break;
            
            //精度が問題あるなら新たなrqを計算して次のループに
            rq = cvmMul(qr[1],qr[0]);
        }
        
        //精度が問題ないか
        if(!isOK){
            throw "最大ループ回数(" + cvTermCriteria.max_iter + ")を超えましたが精度" + cvTermCriteria.eps + "が足りていません";
        }

        
        //固有値を代入
        var eValues = cvCreateMat(R.rows, 1);
        for(var i = 0 ; i < eValues.rows; i++){
            eValues.vals[i] = R.vals[i + i * rq.cols];
        }
        
        //降順に並び替え
        for(var i = 0 ; i < eValues.rows ; i++){
            //最大値のindexを探索
            var maxV = eValues.vals[i];
            var maxIndex = i;
            for(var j = i + 1 ; j < eValues.rows; j++){
                if(maxV < eValues.vals[j]){
                    maxV = eValues.vals[j];
                    maxIndex = j;
                }
            }
            
            //固有値を入れ替える
            var tmp = eValues.vals[i];
            eValues.vals[i] = eValues.vals[maxIndex];
            eValues.vals[maxIndex] = tmp;
            
            //固有ベクトルを入れ替える
            for(var y = 0 ; y < eVects.rows ; y++){
                tmp = eVects.vals[i + y * eVects.cols];
                eVects.vals[i + y * eVects.cols] = eVects.vals[maxIndex + y * eVects.cols];
                eVects.vals[maxIndex + y * eVects.cols] = tmp;
            }
        }
        
        rtn = [eValues, eVects];
    }
    catch(ex){
        alert("cvmEigen : " + ex);
    }
    
    return rtn;
}

//行列の二重対角化
//入力
//mat CvMat型 対角化する行列
//eps double型 計算精度 デフォルト CV_DEF_EPS
function cvmDoubleDiagonalization(mat, eps){
    var rtn = null;
    try{
        //バリデーション
        if(cvUndefinedOrNull(mat))
            throw "mat" + ERROR.IS_UNDEFINED_OR_NULL;
        
        //デフォルト値
        if(cvUndefinedOrNull(eps)) eps = CV_DEF_EPS;
        
        //--内部で使う処理を関数化--
        //行列から指定した範囲の行列を抜き出す
        function partMatrix(mat, sx, sy, ex, ey){
            
            var mcols = ex - sx;
            var mrows = ey - sy;
            
            var mar = cvCreateMat(mrows, mcols);
            for(var i = 0 ; i < mar.rows ; i++){
                for(var j = 0 ; j < mar.cols ; j++){
                    mar.vals[j + i * mar.cols] = mat.vals[sx + j + (sy + i) * mat.cols];
                }
            }
            
            return mar;
        }
        //行列の指定された範囲内のうちの要素の最大値とその座標を返す
        function maxAbsAndXY(ar, sx, sy, ex, ey){
            //デフォルト値
            if(cvUndefinedOrNull(sx)) sx = 0;
            if(cvUndefinedOrNull(sy)) sy = 0;
            if(cvUndefinedOrNull(ex)) ex = ar.cols;
            if(cvUndefinedOrNull(ey)) ey = ar.rows;
            
            var max = Math.abs(ar.vals[sx + sy * ar.cols]);
            var mx = sx;
            var my = sy;
            for(var y = sy ; y < ey ; y++){
                for(var x = sx ; x < ex ; x++){
                    var tmp = Math.abs(ar.vals[x + y * ar.cols]);
                    if(max < tmp){
                        max = tmp;
                        mx = x;
                        my = y;
                    }
                }
            }
            
            return [max, mx, my];
        }
        
        //行列の指定した列ベクトルのノルムの二乗
        function norm2MatrixCol(mat, col, start, end){
            //デフォルト値
            if(cvUndefinedOrNull(start)) start = 0;
            if(cvUndefinedOrNull(end)) end = mat.rows;
            
            var vec = cvCreateMat(end - start, 1);
            for(var i = 0 ; i < vec.rows ; i++){
                vec.vals[i] = mat.vals[col + (i + start) * mat.cols];
            }
            
            return cvmNorm(vec, null, CV_NORM.L2Square);
        }
        
        //行列の指定した行ベクトルのノルムの二乗
        function norm2MatrixRow(mat, row, start, end){
            
            //デフォルト値
            if(cvUndefinedOrNull(start)) start = 0;
            if(cvUndefinedOrNull(end)) end = mat.rows;
            
            var vec = cvCreateMat(end - start, 1);
            for(var i = 0 ; i < vec.rows ; i++){
                vec.vals[i] = mat.vals[i + start + row * mat.cols];
            }
            
            return cvmNorm(vec, null, CV_NORM.L2Square);
        }
        
        //行列の列ベクトルと縦ベクトルのhouseholder変換行列
        function householderMatColVec(mat, col, vec){
            var rtn = null;
            try{
                if(mat.rows != vec.rows)
                    throw "matとvec" + ERROR.DIFFERENT_LENGTH;
                
                var matV = cvCreateMat(mat.rows, 1);
                for(var i = 0 ; i < matV.rows ; i++){
                    matV.vals[i] = mat.vals[col + i * mat.cols];
                }
                
                rtn = cvmHouseHolder(matV, vec);
            }
            catch(ex){
                alert("householderMatColVec : " + ex);
            }
            return rtn;
        }
        
        //行列の行ベクトルと横ベクトルのhouseholder変換行列(ただし１次元配列として返す)
        function householderMatRowVec(mat, row, vec){
            var rtn = null;
            try{
                if(mat.cols != vec.cols)
                    throw "matとvec" + ERROR.DIFFERENT_LENGTH;
                
                var matV = cvCreateMat(1, mat.cols);
                var rw = row * mat.cols;
                for(var i = 0 ; i < matV.cols ; i++){
                    matV.vals[i] = mat.vals[i + rw];
                }
                
                rtn = cvmHouseHolder(matV, vec);
            }
            catch(ex){
                alert("householderMatRowVec : " + ex);
            }
            
            return rtn;
        }
        //----------------------
        
        //matのコピー
        var rtn = cvmCopy(mat);
        
        var sx = sy = 0;
        while(true){
            
            //ar^(times)段階目の対角化を行う小行列を取得
            var mar = partMatrix(rtn, sx, sy, rtn.cols, rtn.rows);
            var mwidth = rtn.cols - sx;
            var mheight = rtn.rows - sy;
            
            var maxVXY;
            var vec;
            var hhMat;
            
            //step6に到達するまでループ 基本はstep1 ~ 6と進む
            var step = 1;
            while(step != -1){
                switch(step){
                    case 1://ar^(times)の要素で絶対値が最大とるなる要素を探す。その値がeps以下なら二重対角化終了
                        
                        maxVXY = maxAbsAndXY(mar, mwidth);
                        if(maxVXY[0] < eps){
                            dWrite(0, "finish");
                            step = -1; //二重対角化終了
                            break;
                        }
                        
                        step = 2;
                        
                        break;
                        
                    case 2://絶対値最大の要素を含む行とar^(times)の第１行を入れ替える
                        for(var i = 0 ; i < mar.cols ; i++){
                            var tmp = mar.vals[i];
                            mar.vals[i] = mar.vals[i + maxVXY[2] * mar.cols];
                            mar.vals[i + maxVXY[2] * mar.cols] = tmp;
                        }
                        
                        step = 3;
                        
                        break;
                        
                    case 3://ar^(times)の第１列において、絶対値が最大となる要素を探す。その値がeps以下ならd_times=0とおきstep6へ
                        maxVXY = maxAbsAndXY(mar, 0, 0, 1, mheight);
                        
                        if(maxVXY[0] > eps){
                            step = 4;
                        }
                        else{
                            mar[0] = 0;
                            step = 6;
                        }
                        
                        break;
                        
                    case 4://ar^(times)の第１列の第２項以下を0とするようなハウスホルダー変換を左からar^(times)に行う
                        vec = cvCreateMat(mheight, 1);
                        vec.vals[0] = Math.sqrt(norm2MatrixCol(mar, 0));
                        for(var i = 1 ; i < vec.rows ; vec.vals[i++] = 0);
                        
                        hhMat = householderMatColVec(mar, 0, vec);
                        
                        mar = cvmMul(hhMat, mar);
                        
                        //最後の２行２列の場合は列方向だけハウスホルダー変換し、対角化が終了となる
                        step = sx == mat.cols - 2 ? -1 : 5;
                        
                        break;
                        
                    case 5://ar^(times)の第１行において第２項以降で絶対値が最大となる要素を探す。その値がeps以下なら第１行第２項を0とおきstep7へ
                        
                        maxVXY = maxAbsAndXY(mar, 1, 0, mwidth, 1);
                        
                        if(maxVXY[0] > eps) step = 6;
                        else{
                            mar.vals[1] = 0;
                            step = -1;
                        }
                        
                        break;
                        
                    case 6://ar^(times)の第１行の第３項以降を０とするようなハウスホルダー変換を右から行う
                        vec = cvCreateMat(1, mwidth);
                        vec.vals[0] = mar.vals[0];
                        vec.vals[1] = Math.sqrt(norm2MatrixRow(mar, 0, 1, mwidth));
                        for(var i = 2 ; i < vec.cols ; vec.vals[i++] = 0);
                        
                        hhMat = householderMatRowVec(mar, 0, vec);
                        
                        mar = cvmMul(mar, hhMat);
                        
                        step = -1;
                        
                        break;
                    default://ループ用パラメータ更新
                        throw "ありえないstepが実行されました";
                        break;
                }
            }
            
            //コピー
            for(var i = 0 ; i < mheight ; i++){
                for(var j = 0 ; j < mwidth ; j++){
                    rtn.vals[sx + j + (sy + i) * rtn.cols] = mar.vals[j + i * mwidth];
                }
            }
            
            sx++;
            sy++;
            if(sx == mat.cols - 1 || sy == mat.rows - 1){ //終了条件
                break;
            }
        }
    }
    catch(ex){
        alert("cvmDoubleDiagonalization : " + ex);
    }
    
    return rtn;
}




//Orthogonal Matching Pursuit
//スパースコーディングの係数選択法
//入力
//vec CvMat型 スパース表現にする行列を１列に並べ替えた縦ベクトル
//dic CvMat型 辞書行列 dic.rows == vec.rows
//出力
//CvMat型  辞書係数 rows = vec.rowsの縦ベクトル
function cvmOMP(vec, dic, cvTermCriteria){
    var rtn = null;
    try{
        //バリデーション
        if(cvUndefinedOrNull(vec) || cvUndefinedOrNull(dic))
            throw "vec or dic" + ERROR.IS_UNDEFINED_OR_NULL;
        
        //バリデーション
        if(dic.rows != mat.rows * mat.cols)
            throw "辞書行列とmatの大きさが合っていません";

        if(cvUndefinedOrNull(cvTermCriteria))
            cvTermCriteria = new CvTermCriteria();

        //係数ベクトル
        rtn = cvCreateMat(vec.rows, 1);
        for(var i = 0 ; i < rtn.rows ; rtn.vals[i++] = 0);
        
        //係数ベクトルに追加されたdicのindex
        var support = new Array();
        
        //選択辞書
        var selectdic = cvCreateMat(dic.rows, 0);
        
        //残差ベクトル
        var residualError = cvmCopy(vec);

        for(var times = 0 ; times < cvTermCriteria.max_iter ; times++){
            
            var maxIndex = -1;
            var maxDist = -1;

            //残差ベクトルとの内積を最も大きくなる辞書内の縦ベクトルのindexを探索する
            for(var dicIndex = 0 ; dicIndex < dic.cols ; dicIndex++){
                //すでに係数ベクトルに存在するindexなら飛ばす
                if(support.indexOf(dicIndex))
                    continue;
                
                //内積
                var dist = 0;
                for(var i = 0 ; i < dic.rows ; i++){
                    dist += dic[i + dicIndex * dic.cols] * residualError.vals[i];
                }
                
                
                //最初の１回
                if(maxIndex < 0){
                    maxIndex = dicIndex;
                    maxDist = dist;
                }
                else if(maxDist < dist){
                    maxIndex = dicIndex;
                    maxDist = dist;
                }
            }
            
            //サポートにインデックスを追加
            support.push(maxIndex);
            
            //辞書の更新
            selectdic = cvmInsertCol(selectdic, dic, maxIndex);
            
            //係数の更新
            var selectdicInv = cvmInverse(selectdic);
            rtn = cvmMul(selectdicInv, vec);
            
            //残差の更新
            residualError = cvmMul(selectdic, rtn);
            
            //残差の大きさ
            var norm = cvmNorm(residualError);
            
            if(norm < cvTermCriteria.eps){
                break;
            }
        }
    }
    catch(ex){
        alert("cvmOMP : " + ex);
    }
    
    return rtn;
}


function cvKMeans2(samples, cluster_count, labels, termcrit){
    try{
        if(cvUndefinedOrNull(samples) || cvUndefinedOrNull(cluster_count) || cvUndefinedOrNull(labels)
           || cvUndefinedOrNull(termcrit))
            throw "samples or cluster_count or labels or termcrit " + ERROR.IS_UNDEFINED_OR_NULL;
        
        function clustering(samples, clusters, labels)
        {
            for(var i = 0 ; i < samples.height ; i++){
                for(var j = 0 ; j < samples.width; j++){
                    var ji = (j + i * samples.width) * CHANNELS;
                    var c1 = samples.RGBA[ji];
                    var c2 = samples.RGBA[1 + ji];
                    var c3 = samples.RGBA[2 + ji];
                    
                    var disC1 = c1 - clusters.RGBA[0];
                    var disC2 = c2 - clusters.RGBA[1];
                    var disC3 = c3 - clusters.RGBA[2];
                    
                    var dis = disC1 * disC1 + disC2 * disC2 + disC3 * disC3;
                    
                    for(var cnum = 1 ; cnum < clusters.width; cnum++){
                        
                    }
                }
            }
        }
    }
    catch(ex){
        alert("cvKMeans2 : " + ex);
    }
}

function cvInPaint(src, mask, dst, inpaintRadius, flags){
    try{
        if(cvUndefinedOrNull(src) || cvUndefinedOrNull(mask) || cvUndefinedOrNull(dst)
           || cvUndefinedOrNull(inpaintRadius))
            throw "src or mask or dst or inpaintRadius " + ERROR.IS_UNDEFINED_OR_NULL;
        if(src.width != dst.width || src.height != dst.height ||
           mask.width != dst.width || mask.height != dst.height)
            throw "src or mask or dst " + ERROR.DIFFERENT_SIZE;
        
        if(flags != CV_INPAINT.TELEA)
            throw "flagsは現在CV_INPAINT.TELENAしかサポートしていません";
        
        function cvInPaintOneLoop(src, mask, dst, inpaintRadius, flags){
            
            // -- maskのエッジ探索 --
            var edge = new cvCreateImage(src.width, src.height);
            cvZero(edge);
            for(var i = 0 ; i < edge.height ; i++){
                if(i != 0 && i != edge.height - 1){
                    for(var j = 0 ; j < edge.width ; j++){
                        var v = 0;
                        if(j != 0 && j != edge.width - 1){
                            //8近傍チェック
                            for(var y = -1 ; y <= 1 ; y++){
                                for(var x = -1 ; x <= 1 ; x++){
                                    if(mask.RGBA[(j + x + (i + y) * mask.width) * CHANNELS] == 0){
                                        v = 255;
                                        break;
                                    }
                                }
                                if(v != 0) break;
                            }
                        }
                        edge.RGBA[(j + i * edge.width) * CHANNELS] = v;
                    }
                }
                else{
                    for(var j = 0 ; j < edge.width ; j++){
                        edge.RGBA[(j + i * edge.width) * CHANNELS] = 255;
                    }
                }
            }
            
            // -- 輝度勾配 --
            gImage = cvCreateImage(src.width, src.height);
            cvZero(gImage);
            for(var i = 0 ; i < gImage.height ; i++){
                for(var j = 0 ; j < gImage.width ; j++){
                    if(edge.RGBA[(j + i * edge.width) * CHANNNELS] != 0){
                        for(var c = 0 ; c < 3 ; c++){
                            var dx = src.RGBA[(j + 1 + i * src.width) * CHANNNELS] - src.RGBA[(j - 1 + i * src.width) * CHANNNELS];
                            var dx = src.RGBA[(j + (i + 1) * src.width) * CHANNNELS] - src.RGBA[(j + (i - 1) * src.width) * CHANNNELS];
                        }
                    }
                }
            }
            
            switch(flags){
                case CV_INPAINT.NS:
                    break;
                default:
                    break;
            }
        }
    }
    catch(ex){
        alert("cvInPaint : " + ex);
    }
}

//ハフ変換
//入力
//src IplImage型 GRAY表色系を想定(RGB表色系ならRで実行される)
//method CV_HOUGH型 ハフ変換の種類
//rho 少数 距離解像度 1ピクセルあたりの単位
//theta 少数 角度解像度 ラジアン単位
//threshold 整数 対応する投票数がこの値より大きい場合のみ抽出された直線が返される
//param1 少数 各手法に応じたパラメータ 解説参照
//param2 少数 各手法に応じたパラメータ 解説参照
//出力
//[ラインの数][ラインの情報]の二次元配列が返る
//[X][0]にrhoの値
//[X][1]にthetaの値
//解説
//CV_HOUGH.STANDARDの場合
//  param1,param2共に使用しない(0)
//CV_HOUGH.PROBABILISTICの場合
//  param1は最小の線の長さ使用しない(0)
//  param2は同一線として扱う線分の最大間隔
//CV_HOUGH.MULTI_SCALEの場合
//  param1はrhoの序数（荒い距離はrho,詳細な距離ではrho/param1）
//  param2はthetaの序数 （荒い角度はtheta,詳細な角度ではtheta/param2）
//http://codezine.jp/article/detail/153
function cvHoughLines2(src, method, rho, theta, threshold, param1, param2){
    var rtn = null;
    try{
        if(cvUndefinedOrNull(src) || cvUndefinedOrNull(method) ||
           cvUndefinedOrNull(rho) || cvUndefinedOrNull(theta) || cvUndefinedOrNull(threshold))
            throw "引数のどれか" + ERROR.IS_UNDEFINED_OR_NULL;
        
        if(method != CV_HOUGH.STANDARD)
            throw "methodは現在CV_HOUGH.STANDARDしかサポートしていません";
        
        if(cvUndefinedOrNull(param1)) param1 = 0;
        if(cvUndefinedOrNull(param2)) param2 = 0;
        
        //---------------------------------------
        //-- 初期化 --
        //---------------------------------------
        var rtn = new Array();
        var thetaMax = Math.floor(Math.PI/theta);
        var sn = new Array(thetaMax); //サインカーブ配列
        var cs = new Array(thetaMax);//コサインカーブ配列
        var diagonal = new Array(src.height);//半径計算用斜線長テーブル
        
        var counter = new Array(thetaMax);//直線検出用頻度カウンタ
        var rhoMax = Math.floor(Math.sqrt(src.width * src.width + src.height * src.height) + 0.5);
        for(var i = 0 ; i < counter.length ; i++){
            counter[i] = new Array(2 * rhoMax);
            for(var j = 0 ; j < counter[i].length ; j++){
                counter[i][j] = 0;
            }
        }
        
        //三角関数テーブルを作成
        for(var i = 0 ; i < sn.length ; i++){
            sn[i] = Math.sin(i * theta);
            cs[i] = Math.cos(i * theta);
        }
        
        
        switch(method){
                
            case CV_HOUGH.STANDARD:
                
                for(var i = 0 ; i < src.height ; i++){
                    var is = i * src.width * CHANNELS;
                    var js = 0;
                    for(var j = 0 ; j < src.width ; j++){
                        if(src.RGBA[js + is] == 255){
                            for(var t = 0 ; t < thetaMax; t++){
                                r = Math.floor(j * cs[t] + i * sn[t] + 0.5);
                                counter[t][r + rhoMax]++;
                            }
                        }
                        js += CHANNELS;
                    }
                }
                
                break;
                
            case CV_HOUGH.PROBABILISTIC:
                break;
            case CV_HOUGH.MULTI_SCALE:
                break;
        }
        
        var num = 0;
        for(var t = 0 ; t < counter.length ; t++){
            for(var r = 0 ; r < counter[t].length ; r++){
                if(counter[t][r] > threshold){
                    rtn[num] = new Array(2);
                    rtn[num][0] = r - rhoMax;
                    rtn[num][1] = t;
                    num++;
                }
            }
        }
    }
    catch(ex){
        alert("cvHoughLines2 : " + ex);
    }
    
    return rtn;
}

