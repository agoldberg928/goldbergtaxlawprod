import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { BankStatementInfo } from '../../../model/statementModel';
import { BarChart, BarSeriesType } from '@mui/x-charts';
import { getMonthsForXAxis, getXAxisLabel } from '../StatementsDashboard';

function AreaGradient({ color, id }: { color: string; id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor={color} stopOpacity={0.5} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

function getDataSeries(accountMap: Map<string, BankStatementInfo[]>, xAxisLabels: string[]): BarSeriesType[] {
    return accountMap.map((account, stmts) => {
        return {
            type: 'bar' as 'bar',
            id: account,
            label: account,
            // showMark: false,
            // curve: 'catmullRom' as CurveType,
            stack: 'total',
            // area: true,
            // stackOrder: 'ascending' as StackOrderType,
            data: xAxisLabels.map((label) => {
                const matchingStatement: BankStatementInfo | undefined = stmts.find((stmt) => getXAxisLabel(stmt.date) === label)
                if (!matchingStatement) return 1
                else return null
            }),
            valueFormatter: ((val) => {
                if (val) return `MISSING`
                else return `AVAILABLE`}
            ),
            // connectNulls: true
          } as BarSeriesType
    })
}

interface MissingStatementsChartProps {
    statements: BankStatementInfo[]
}

export default function MissingStatementsChart({statements}: MissingStatementsChartProps) {
  const theme = useTheme();
  const accountMap: Map<string, BankStatementInfo[]> = statements.reduce((map, stmt) => {
    const account = `${stmt.bankName} - ${stmt.account}`;

    if (!map.has(account)) {
        map.set(account, []);
    }

    map.get(account).push(stmt);

    return map;
  }, new Map());

  const [firstDate, lastDate] = [statements[0].date, statements[statements.length - 1].date]
  const xAxisLabels = getMonthsForXAxis(statements);
  const data = getDataSeries(accountMap, xAxisLabels)

  const sxAddFill = Array.from(accountMap.keys()).reduce((map, id) => {return {...map, [`& .MuiAreaElement-series-${id}`]: {
        fill: `url('#${id}')`,
    }}}, {})

  const totalNumberOfMissingStatements = data.reduce(((prev, series) => {
    return prev + series.data!.reduce(((prev: number, val) => {return prev + (val ?? 0)}), 0)
  }), 0)

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardContent>
        <Typography component="h2" variant="subtitle2" gutterBottom>
          Missing Statements By Month
        </Typography>
        <Stack sx={{ justifyContent: 'space-between' }}>
          <Stack
            direction="row"
            sx={{
              alignContent: { xs: 'center', sm: 'flex-start' },
              alignItems: 'center',
              gap: 1,
            }}
          >
            |
            <Typography variant="h4" component="p">
              {totalNumberOfMissingStatements}
            </Typography>
            <Chip size="small" color="info" label="Total" />
            |
            <Typography variant="h4" component="p">
              {Math.round(totalNumberOfMissingStatements/statements.length)}
            </Typography>
            <Chip size="small" color="warning" label="Avg" />
            |
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Statements between {getXAxisLabel(firstDate)} and {getXAxisLabel(lastDate)}
          </Typography>
        </Stack>
        <BarChart
        //   colors={colorPalette}
          borderRadius={4}
          xAxis={[
            {
                scaleType: 'band',
                categoryGapRatio: 0.5,
                data: xAxisLabels,
            },
          ] as any}
          series={data}
          height={500}
          margin={{ left: 75, right: 20, top: 20, bottom: 75 }}
          grid={{ horizontal: true }}
          // layout="horizontal"
          sx={sxAddFill}
        //   {{
        //     '& .MuiAreaElement-series-organic': {
        //       fill: "url('#organic')",
        //     },
        //     '& .MuiAreaElement-series-referral': {
        //       fill: "url('#referral')",
        //     },
        //     '& .MuiAreaElement-series-direct': {
        //       fill: "url('#direct')",
        //     },
        //   }}
          slotProps={{
            legend: {
            //   hidden: true,
              position: { vertical: 'bottom', horizontal: 'middle' },
            },
          }}
        >
          <AreaGradient color={theme.palette.primary.dark} id="organic" />
          <AreaGradient color={theme.palette.primary.main} id="referral" />
          <AreaGradient color={theme.palette.primary.light} id="direct" />
        </BarChart>
      </CardContent>
    </Card>
  );
}
