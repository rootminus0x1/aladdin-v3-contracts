datafile = "aladdin-fx-market-plot.CRxETH.gnuplot.csv"
# additional imformation and error in aladdin-fx-market-plot.CRxETH.error.csv
set key autotitle columnheader
set datafile separator comma
set key bmargin
# set terminal pngcairo
# set output "aladdin-fx-market-plot.CRxETH.gnuplot.png
set terminal svg enhanced size 800 500 background rgb "gray90"
set autoscale
# set output "aladdin-fx-market-plot.CRxETH.gnuplot.svg
set xlabel "Ether Price (USD)"
set colorsequence default
set ylabel "collateral ratio"
set ytics
set y2label "FractionalToken.balanceOf(the rebalance pool) (sqrt)"
set nonlinear y2 via sqrt(y) inverse y*y
set y2tics
set xrange reverse
plot datafile using 2:($3) with lines linetype 8 linewidth 3 dashtype 3 ,\
     datafile using 2:($5) with lines linetype 1 ,\
     datafile using 2:($6) with lines linetype 1 linewidth 2 dashtype 2 axes x1y2,\
     datafile using 2:($8) with lines linetype 2 ,\
     datafile using 2:($9) with lines linetype 2 linewidth 2 dashtype 2 axes x1y2,\
     datafile using 2:($11) with lines linetype 4 ,\
     datafile using 2:($12) with lines linetype 4 linewidth 2 dashtype 2 axes x1y2