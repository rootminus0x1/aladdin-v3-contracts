set title "CRxbalance+liquidate-BoostableRebalancePool__wstETHWrapper" noenhanced
datafile = "fx.CRxbalance+liquidate-BoostableRebalancePool__wstETHWrapper.gnuplot.csv"
# additional imformation and error in fx.CRxbalance+liquidate-BoostableRebalancePool__wstETHWrapper.error.csv
set datafile separator comma
set key autotitle columnheader noenhanced
set key bmargin
set key title " "
# set terminal pngcairo
# set output "fx.CRxbalance+liquidate-BoostableRebalancePool__wstETHWrapper.gnuplot.png"
set terminal svg enhanced size 800 756.5 background rgb "gray90"
set autoscale
set colorsequence default
# set output "fx.CRxbalance+liquidate-BoostableRebalancePool__wstETHWrapper.gnuplot.svg"
set xrange reverse
set xlabel "Collateral ratio" noenhanced
set xtics
set xtics nomirror
set xrange [1.5:0.9]
set ylabel "Pool balance of fETH/xETH" noenhanced
set ytics
set ytics nomirror
set yrange [-10000:*<50000000]
set y2label "Change in balance of (ETH-ish)" noenhanced
set y2tics
set y2tics nomirror
plot datafile using ($2):($4) with lines linetype 2 linewidth 2 dashtype 2,\
     datafile using ($2):($5 == 0 ? 1/0 : $5) with lines linetype 1 linewidth 2 dashtype 2,\
     datafile using ($2):($6 == 0 ? 1/0 : $6) with lines linetype 1 linewidth 4 dashtype 3,\
     datafile using ($2):($7) with linespoints linetype 4 pointtype 1 axes x1y2,\
     datafile using ($2):($8) with linespoints linetype 4 pointtype 2 axes x1y2,\
     datafile using ($2):($9) with linespoints linetype 4 pointtype 4 axes x1y2,\
     datafile using ($2):($10) with linespoints linetype 4 pointtype 6 axes x1y2,\
     datafile using ($2):($11) with linespoints linetype 4 pointtype 8 axes x1y2,\
     datafile using ($2):($12 == 0 ? 1/0 : $12) with linespoints linetype 6 pointtype 1 axes x1y2,\
     datafile using ($2):($13 == 0 ? 1/0 : $13) with linespoints linetype 6 pointtype 2 axes x1y2,\
     datafile using ($2):($14) with linespoints linetype 8 pointtype 1 axes x1y2,\
     datafile using ($2):($15) with linespoints linetype 8 pointtype 2 axes x1y2
# stats datafile using 1 nooutput
# min = STATS_min
# max = STATS_max
# range_extension = 0.2 * (max - min)
# set xrange [min - range_extension : max + range_extension]
# stats datafile using 2 nooutput
# min = STATS_min
# max = STATS_max
# range_extension = 0.2 * (max - min)
# set yrange [min - range_extension : max + range_extension]
# stats datafile using 3 nooutput
# min = STATS_min
# max = STATS_max
# range_extension = 0.2 * (max - min)
# set y2range [min - range_extension : max + range_extension]