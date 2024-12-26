import { getWeeklyETFValues, getCurrentETFValue } from './binance.js'
import express from 'express'
import cors from 'cors'
const app = express()
const port = 5000

//change to actual cors code later
app.use(cors())

app.get('/current_price', async (req, res) => {
  const etfName = req.query.etfName; 
  if (!etfName) {
    return res.status(400).send({ error: 'Missing required parameter: etfName' });
  }
  try {
    const prices = await getCurrentETFValue(etfName);
    res.send(JSON.stringify(prices));
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: 'Failed to fetch current price' });
  }
});

app.get('/weekly_prices', async (req, res) => {
  const etfName = req.query.etfName; 
  if (!etfName) {
    return res.status(400).send({ error: 'Missing required parameter: etfName' });
  }
  try {
    const prices = await getWeeklyETFValues(etfName);
    res.send(JSON.stringify(prices));
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: 'Failed to fetch weekly prices' });
  }
});

app.listen(port, () => {
  console.log(`listening on port ${port}`)
});