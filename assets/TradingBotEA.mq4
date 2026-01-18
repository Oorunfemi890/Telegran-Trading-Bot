//+------------------------------------------------------------------+
//|                                                 TradingBotEA.mq4 |
//|                                  Telegram Signal Trading Bot EA |
//|                                    https://your-trading-bot.com |
//+------------------------------------------------------------------+
#property copyright "Trading Bot"
#property link      "https://your-trading-bot.com"
#property version   "1.00"
#property strict

//--- Input parameters
input string API_URL = "https://your-api-url.com/api/v1/ea"; // API Base URL
input string API_TOKEN = ""; // Your EA Token (from dashboard)
input int POLL_INTERVAL = 5; // Poll interval in seconds
input int MAGIC_NUMBER = 123456; // Magic number for orders
input double MAX_SLIPPAGE = 3.0; // Maximum slippage in points
input bool ENABLE_LOGGING = true; // Enable detailed logging

//--- Global variables
datetime lastPollTime = 0;
datetime lastPingTime = 0;
string headers;
char postData[];
char resultData[];
string resultHeaders;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Validate inputs
   if(StringLen(API_TOKEN) == 0)
   {
      Print("ERROR: API_TOKEN is empty! Please configure the EA.");
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   if(StringLen(API_URL) == 0)
   {
      Print("ERROR: API_URL is empty!");
      return(INIT_PARAMETERS_INCORRECT);
   }
   
   // Set up HTTP headers
   headers = "Content-Type: application/json\r\n";
   headers += "x-ea-token: " + API_TOKEN + "\r\n";
   
   Print("==============================================");
   Print("Trading Bot EA Initialized");
   Print("==============================================");
   Print("API URL: ", API_URL);
   Print("Poll Interval: ", POLL_INTERVAL, " seconds");
   Print("Magic Number: ", MAGIC_NUMBER);
   Print("==============================================");
   
   // Send initial ping
   SendPing();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("EA stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Poll for instructions every POLL_INTERVAL seconds
   if(TimeCurrent() >= lastPollTime + POLL_INTERVAL)
   {
      PollInstructions();
      lastPollTime = TimeCurrent();
   }
   
   // Send ping every 30 seconds
   if(TimeCurrent() >= lastPingTime + 30)
   {
      SendPing();
      lastPingTime = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Poll for trade instructions                                      |
//+------------------------------------------------------------------+
void PollInstructions()
{
   string url = API_URL + "/instructions";
   
   ResetLastError();
   
   int res = WebRequest(
      "GET",
      url,
      headers,
      5000, // 5 second timeout
      postData,
      resultData,
      resultHeaders
   );
   
   if(res == -1)
   {
      int error = GetLastError();
      if(error == 4060)
      {
         Print("ERROR: Add '", API_URL, "' to allowed URLs in Tools -> Options -> Expert Advisors");
      }
      else
      {
         if(ENABLE_LOGGING) Print("WebRequest error: ", error);
      }
      return;
   }
   
   if(res == 200)
   {
      string response = CharArrayToString(resultData);
      ProcessInstructions(response);
   }
   else
   {
      if(ENABLE_LOGGING) Print("HTTP Error: ", res);
   }
}

//+------------------------------------------------------------------+
//| Process trade instructions from server                           |
//+------------------------------------------------------------------+
void ProcessInstructions(string jsonResponse)
{
   // Simple JSON parsing
   if(StringFind(jsonResponse, "\"success\":true") == -1)
   {
      return; // No instructions
   }
   
   if(StringFind(jsonResponse, "\"instructions\":[]") != -1)
   {
      return; // Empty instructions
   }
   
   if(ENABLE_LOGGING) Print("Received instructions: ", jsonResponse);
   
   // Parse and execute each instruction
   ExecuteInstructions(jsonResponse);
}

//+------------------------------------------------------------------+
//| Execute trade instructions                                       |
//+------------------------------------------------------------------+
void ExecuteInstructions(string jsonResponse)
{
   // Placeholder for JSON parsing
   // In production, use a proper JSON library
   
   Print("Executing instructions (placeholder)");
}

//+------------------------------------------------------------------+
//| Open a position (MT4 version)                                   |
//+------------------------------------------------------------------+
bool OpenPosition(
   string tradeId,
   string positionId,
   string symbol,
   string direction,
   double entryPrice,
   double lotSize,
   double stopLoss,
   double takeProfit,
   string orderType
)
{
   int cmd = (direction == "buy") ? OP_BUY : OP_SELL;
   double price = (orderType == "market") ? 
                  ((direction == "buy") ? Ask : Bid) : 
                  entryPrice;
   
   color clr = (direction == "buy") ? clrBlue : clrRed;
   
   int ticket = OrderSend(
      symbol,
      cmd,
      lotSize,
      price,
      (int)MAX_SLIPPAGE,
      stopLoss,
      takeProfit,
      "TradingBot-" + positionId,
      MAGIC_NUMBER,
      0,
      clr
   );
   
   if(ticket > 0)
   {
      Print("Position opened: #", ticket, " for ", symbol);
      ReportExecution(tradeId, positionId, true, IntegerToString(ticket), price, "");
      return true;
   }
   else
   {
      int error = GetLastError();
      Print("OrderSend error: ", error);
      ReportExecution(tradeId, positionId, false, "", 0, "Error: " + IntegerToString(error));
      return false;
   }
}

//+------------------------------------------------------------------+
//| Report execution result to server                                |
//+------------------------------------------------------------------+
void ReportExecution(
   string tradeId,
   string positionId,
   bool success,
   string mtOrderTicket,
   double openPrice,
   string errorMsg
)
{
   string url = API_URL + "/report";
   
   // Build JSON payload
   string payload = "{";
   payload += "\"tradeId\":\"" + tradeId + "\",";
   payload += "\"positionId\":\"" + positionId + "\",";
   payload += "\"success\":" + (success ? "true" : "false");
   
   if(success)
   {
      payload += ",\"mtOrderTicket\":\"" + mtOrderTicket + "\"";
      payload += ",\"openPrice\":" + DoubleToString(openPrice, 5);
      payload += ",\"executionTime\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
   }
   else
   {
      payload += ",\"error\":\"" + errorMsg + "\"";
   }
   
   payload += "}";
   
   // Convert to char array
   StringToCharArray(payload, postData, 0, StringLen(payload));
   
   ResetLastError();
   
   int res = WebRequest(
      "POST",
      url,
      headers,
      5000,
      postData,
      resultData,
      resultHeaders
   );
   
   if(res == 200)
   {
      if(ENABLE_LOGGING) Print("Execution reported successfully");
   }
   else
   {
      if(ENABLE_LOGGING) Print("Failed to report execution. HTTP: ", res);
   }
}

//+------------------------------------------------------------------+
//| Send heartbeat ping to server                                    |
//+------------------------------------------------------------------+
void SendPing()
{
   string url = API_URL + "/ping";
   
   // Get account info (MT4 version)
   double balance = AccountBalance();
   double equity = AccountEquity();
   double freeMargin = AccountFreeMargin();
   int openPositions = OrdersTotal();
   
   // Build JSON payload
   string payload = "{";
   payload += "\"accountNumber\":\"" + IntegerToString(AccountNumber()) + "\",";
   payload += "\"broker\":\"" + AccountCompany() + "\",";
   payload += "\"balance\":" + DoubleToString(balance, 2) + ",";
   payload += "\"equity\":" + DoubleToString(equity, 2) + ",";
   payload += "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ",";
   payload += "\"openPositions\":" + IntegerToString(openPositions);
   payload += "}";
   
   // Convert to char array
   StringToCharArray(payload, postData, 0, StringLen(payload));
   
   ResetLastError();
   
   int res = WebRequest(
      "POST",
      url,
      headers,
      5000,
      postData,
      resultData,
      resultHeaders
   );
   
   if(res != 200 && ENABLE_LOGGING)
   {
      Print("Ping failed. HTTP: ", res);
   }
}
//+------------------------------------------------------------------+