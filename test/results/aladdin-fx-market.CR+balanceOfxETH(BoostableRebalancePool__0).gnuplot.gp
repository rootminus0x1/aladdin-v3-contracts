datafile = "aladdin-fx-market.CR+balanceOfxETH(BoostableRebalancePool__0).gnuplot.csv"
# additional imformation and error in aladdin-fx-market.CR+balanceOfxETH(BoostableRebalancePool__0).error.csv
set datafile separator comma
set key autotitle columnheader
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx-market.CR+balanceOfxETH(BoostableRebalancePool__0).gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
# set output "aladdin-fx-market.CR+balanceOfxETH(BoostableRebalancePool__0).gnuplot.svg
set xlabel "Ether Price (USD)"
set colorsequence default
set ylabel "collateral ratio"
set ytics
set y2label "FractionalToken.balanceOf(BoostableRebalancePool__0)"
set y2tics
set xrange reverse
plot datafile using 2:($3) with lines linetype 8 linewidth 3 dashtype 3 ,\
     datafile using 2:($5) with lines linetype 1 ,\
     datafile using 2:($6) with lines linetype 2 axes x1y2